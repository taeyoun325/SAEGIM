import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, radius } from '../constants/theme';
import { Writing, DailyPrompt } from '../types/models';
import { getWritingById, softDeleteWriting, TRASH_GRACE_DAYS } from '../services/writingService';
import { publishWriting, deleteWritingCompletely } from '../services/postService';
import { adjustPublicPostCount, syncUserCounts } from '../services/userService';
import { getPromptById } from '../services/promptService';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useShare } from '../context/ShareContext';
import { formatDisplayDate, timestampToDateString } from '../utils/date';
import { moodLabel } from '../constants/moods';
import { containsSensitiveWord } from '../utils/textFilter';
import { logEvent } from '../services/statsService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// 아직 게시하지 않은 내 글의 상세 화면.
//
// 게시한 글은 PostDetail로 열리는데 게시하지 않은 글은 눌러도 아무 일이 없어서,
// 목록에서 두 줄 미리보기(numberOfLines)로 잘린 글은 전문을 볼 방법이 없었다.
// 화면 구성은 PostDetail과 일부러 맞췄다 — 같은 카드에 같은 자리의 동작 줄.
// 다만 비공개 글에는 좋아요·댓글·저장·신고가 존재하지 않으므로, 그 자리에는
// 이 글에 실제로 할 수 있는 일(공유·게시·삭제)을 둔다.
export default function WritingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { writingId } = route.params as { writingId: string };
  const { user, profile, refreshProfile } = useAuth();
  const { confirm, notify } = useDialog();
  const { share } = useShare();

  const [writing, setWriting] = useState<Writing | null>(null);
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const w = await getWritingById(writingId);
      // 다른 기기에서 지웠거나 휴지통으로 보낸 글일 수 있다. 무한 로딩으로 두지 않고
      // 빠져나갈 길을 보여준다(PostDetail의 '찾을 수 없어요'와 같은 처리).
      if (!w || w.userId !== user?.uid || w.deletedAt) {
        setNotFound(true);
        return;
      }
      setWriting(w);
      // 글감은 없어도 화면이 성립하므로(제목 줄만 빠진다) 실패를 삼킨다.
      setPrompt(await getPromptById(w.promptId).catch(() => null));
    } finally {
      setLoading(false);
    }
  }, [writingId, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleShare() {
    if (!writing) return;
    share({ lines: writing.lines, createdAt: writing.createdAt, filename: `saegim-${writing.id}` });
  }

  // TodayScreen의 게시 흐름과 같다. 공개 글 수를 함께 올려야 프로필 숫자가 맞는다.
  async function handlePublish() {
    if (!writing || !user || writing.postId) return;
    const flagged = containsSensitiveWord(writing.lines.join('\n'));
    const ok = await confirm({
      title: '이 글을 공개할까요?',
      message: flagged
        ? '다른 사람들이 오늘의 글감 페이지에서 볼 수 있어요.\n⚠️ 다른 사람이 상처받을 수 있는 표현이 있는지 한 번 더 확인해보세요.'
        : '다른 사람들이 오늘의 글감 페이지에서 볼 수 있어요.',
      confirmLabel: '게시하기',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const postId = await publishWriting(writing);
      await adjustPublicPostCount(user.uid, 1);
      await refreshProfile();
      logEvent('publish').catch(() => {});
      // 게시했으면 이 글은 더 이상 "비공개 새김"이 아니다. 뒤로 갔다가 다시 눌렀을 때
      // 헷갈리지 않도록 곧바로 게시물 화면으로 바꿔준다.
      navigation.replace('PostDetail', { postId });
    } catch (e: any) {
      await notify('오류', e?.message || '게시에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!writing) return;
    const ok = await confirm({
      title: '이 글을 삭제할까요?',
      message: `${TRASH_GRACE_DAYS}일 안에는 [내 새김 관리 → 휴지통]에서 복구할 수 있어요.`,
      confirmLabel: '삭제하기',
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      // 비공개 글은 휴지통으로 보낸다. 게시했다가 내린 글이 남아 postId가 붙어 있는
      // 예외적인 경우에만 딸린 게시물까지 함께 정리한다.
      if (writing.postId) {
        await deleteWritingCompletely(writing.id, writing.postId);
      } else {
        await softDeleteWriting(writing.id);
      }
      // 프로필의 글 수는 비정규화된 값이라 삭제만으로는 줄지 않는다. 직접 -1 하지 않고
      // 실제 문서 수로 다시 맞춘다(내 새김 관리의 삭제 경로와 같은 처리).
      if (profile) await syncUserCounts(writing.userId, profile);
      await refreshProfile();
      navigation.goBack();
    } catch (e) {
      await notify('오류', '삭제에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>이 글을 찾을 수 없어요.{'\n'}지웠거나 휴지통에 있는 글일 수 있어요.</Text>
        <TouchableOpacity
          style={styles.notFoundButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Text style={styles.notFoundButtonText}>뒤로 가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || !writing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const mood = writing.mood ? moodLabel(writing.mood) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.nickname}>{profile?.nickname ?? '나'}</Text>
        {writing.lines.map((line, i) => (
          <Text key={i} style={styles.line}>
            {line}
          </Text>
        ))}

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatDisplayDate(timestampToDateString(writing.createdAt))}</Text>
          {writing.mood && (
            <Text style={styles.metaText}>
              {writing.mood}
              {mood ? ` ${mood}` : ''}
            </Text>
          )}
          <Text style={styles.privateBadge}>🔒 비공개</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={handleShare} accessibilityRole="button" accessibilityLabel="공유하기">
            <Text style={styles.actionText}>📤 공유</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePublish}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="이 글 게시하기"
          >
            <Text style={styles.publishText}>🌐 게시하기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="이 글 삭제하기"
          >
            <Text style={styles.deleteText}>삭제</Text>
          </TouchableOpacity>
        </View>
      </View>

      {prompt && (
        <View style={styles.promptCard}>
          <Text style={styles.promptLabel}>이 날의 글감</Text>
          <Text style={styles.promptTitle}>{prompt.title}</Text>
        </View>
      )}

      <Text style={styles.hint}>
        아직 나만 볼 수 있는 글이에요. 게시하면 같은 글감을 받은 사람들이 읽고 좋아요와 댓글을 남길 수 있어요.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nickname: { fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  line: { color: colors.text, fontSize: 16, lineHeight: 26 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  metaText: { color: colors.textSoft, fontSize: 13 },
  privateBadge: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionText: { color: colors.textSoft, fontSize: 14, fontWeight: '600' },
  publishText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  promptCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  promptLabel: { color: colors.textSoft, fontSize: 12 },
  promptTitle: { color: colors.primary, fontSize: 18, fontWeight: '800', marginTop: 2 },
  hint: { color: colors.textSoft, fontSize: 13, lineHeight: 20, marginTop: spacing.lg },
  notFoundText: { color: colors.textSoft, textAlign: 'center', lineHeight: 22 },
  notFoundButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  notFoundButtonText: { color: colors.primary, fontWeight: '700' },
});
