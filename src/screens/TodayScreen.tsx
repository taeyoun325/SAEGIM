import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../constants/theme';
import { WRITING_TOTAL_MAX_LENGTH } from '../constants/config';
import { DailyPrompt, Writing } from '../types/models';
import { MainTabParamList } from '../navigation/types';
import { getTodayPrompt } from '../services/promptService';
import {
  createWriting,
  getMyWritingForPrompt,
  validateLines,
  updateWritingContent,
  updateWritingMood,
} from '../services/writingService';
import { MOOD_OPTIONS } from '../constants/moods';
import { publishWriting, unpublishPost, updatePostContent } from '../services/postService';
import { recordTodayWriting, adjustPublicPostCount } from '../services/userService';
import { evaluateAndAwardBadges } from '../services/badgeService';
import { BadgeDef } from '../constants/badges';
import { logEvent } from '../services/statsService';
import { saveDraft, loadDraft, clearDraft, isPromptRevealed, markPromptRevealed } from '../services/draftService';
import { containsSensitiveWord } from '../utils/textFilter';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { todayDateString, yearsAgoPromptId } from '../utils/date';
import PromptSticker from '../components/PromptSticker';
import BackgroundMascot from '../components/BackgroundMascot';
import TopBarButtons from '../components/TopBarButtons';
import BadgeCelebrationModal from '../components/BadgeCelebrationModal';
import { useShare } from '../context/ShareContext';

type TabNav = NativeStackNavigationProp<MainTabParamList>;

const MEMORY_LOOKBACK_YEARS = [1, 2, 3, 4, 5];

export default function TodayScreen() {
  const tabNavigation = useNavigation<TabNav>();
  const { user, profile, refreshProfile } = useAuth();
  const { confirm, notify } = useDialog();
  const { share } = useShare();
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [writing, setWriting] = useState<Writing | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [memories, setMemories] = useState<{ years: number; writing: Writing }[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [celebrationBadge, setCelebrationBadge] = useState<BadgeDef | null>(null);
  const writeStartLogged = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const p = await getTodayPrompt();
      setPrompt(p);
      if (p) {
        setRevealed(await isPromptRevealed(user.uid, p.id));
        const w = await getMyWritingForPrompt(user.uid, p.id);
        setWriting(w);
        setMood(w?.mood ?? null);
        if (w) {
          setText(w.lines.join('\n'));
        } else {
          const draft = await loadDraft(user.uid, p.id);
          if (draft) {
            setText(draft.join('\n'));
            setDraftRestored(true);
          } else {
            // 화면을 나가지 않은 채로 오늘 글이 지워지면(휴지통) writing이 null이 되는데,
            // 여기서 text를 비워주지 않으면 화면에 남아있던 지난 내용이 다음 입력의
            // 시작값처럼 보인다 — 실제로는 저장된 적 없는 글인데도 계속 남아있던 것.
            setText('');
            setDraftRestored(false);
          }
        }
      }
      // 1년 전 오늘부터 최대 5년 전까지, 그해 오늘 쓴 글이 있으면 전부 회고 카드로
      // 보여준다(오래 써온 사용자일수록 여러 해의 기록이 함께 보인다). 없는 해는
      // 조용히 넘어간다 — 가입한 지 1년이 안 된 사용자에겐 항상 없는 게 정상이다.
      const pastYears = await Promise.all(
        MEMORY_LOOKBACK_YEARS.map(async (years) => {
          const w = await getMyWritingForPrompt(user.uid, yearsAgoPromptId(years));
          return w ? { years, writing: w } : null;
        })
      );
      setMemories(pastYears.filter((m): m is { years: number; writing: Writing } => m !== null));
    } catch (e) {
      setError('오늘의 글감을 불러오지 못했어요. 인터넷 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // 서버에 저장되지 않은 상태에서 입력이 바뀌면 로컬에 임시 저장한다(디바운스).
  useEffect(() => {
    if (!user || !prompt || writing) return;
    const timer = setTimeout(() => {
      if (text.trim().length > 0) saveDraft(user.uid, prompt.id, text.split('\n'));
    }, 500);
    return () => clearTimeout(timer);
  }, [text, user, prompt, writing]);

  async function handleReveal() {
    setRevealed(true);
    logEvent('prompt_reveal').catch(() => {});
    if (user && prompt) await markPromptRevealed(user.uid, prompt.id);
  }

  // 글쓰기 시작은 세션당 한 번만 남긴다(타이핑마다 쓰면 비용이 커진다).
  function handleChangeText(next: string) {
    if (!writeStartLogged.current && next.trim().length > 0) {
      writeStartLogged.current = true;
      logEvent('write_start').catch(() => {});
    }
    setText(next);
  }

  // 이미 저장된 글이면 기분만 바로 서버에 반영하고, 아직 안 쓴 글이면 로컬에만
  // 두었다가 저장(handleSave)할 때 함께 만든다.
  async function handleMoodPress(emoji: string) {
    const next = mood === emoji ? null : emoji;
    setMood(next);
    if (writing) {
      try {
        await updateWritingMood(writing.id, next);
        setWriting({ ...writing, mood: next });
      } catch (e) {
        setMood(mood);
      }
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSave(publish: boolean) {
    if (!user || !prompt) return;
    setError(null);

    const lines = text.split('\n');
    const { valid, reason } = validateLines(lines);
    if (!valid) {
      setError(reason ?? '내용을 확인해주세요.');
      return;
    }

    if (publish) {
      const flagged = containsSensitiveWord(text);
      const ok = await confirm({
        title: '이 글을 공개할까요?',
        message: flagged
          ? '다른 사람들이 오늘의 글감 페이지에서 볼 수 있어요.\n⚠️ 다른 사람이 상처받을 수 있는 표현이 있는지 한 번 더 확인해보세요.'
          : '다른 사람들이 오늘의 글감 페이지에서 볼 수 있어요.',
        confirmLabel: '게시하기',
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      let currentWriting = writing;
      const cleanLines = lines.filter((l) => l.trim().length > 0);
      let newBadges: BadgeDef[] = [];
      let freezeUsed = false;

      if (!currentWriting) {
        const id = await createWriting(user.uid, prompt.id, lines, 'private', prompt.category, mood);
        const result = await recordTodayWriting(user.uid, todayDateString());
        if (result) {
          freezeUsed = result.freezeUsed;
          const awarded = await evaluateAndAwardBadges(user.uid, result.profile);
          newBadges = awarded.newBadges;
        }
        currentWriting = {
          id,
          userId: user.uid,
          promptId: prompt.id,
          lines: cleanLines,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          visibility: 'private',
          postId: null,
          mood,
        };
      } else if (JSON.stringify(currentWriting.lines) !== JSON.stringify(cleanLines)) {
        await updateWritingContent(currentWriting.id, lines);
        currentWriting = { ...currentWriting, lines: cleanLines, updatedAt: Date.now() };
        if (currentWriting.postId) {
          await updatePostContent(currentWriting.postId, lines);
        }
      }

      if (publish && !currentWriting.postId) {
        const postId = await publishWriting({ ...currentWriting, lines: currentWriting.lines });
        await adjustPublicPostCount(user.uid, 1);
        currentWriting = { ...currentWriting, visibility: 'public', postId };
      }

      setWriting(currentWriting);
      await clearDraft(user.uid, prompt.id);
      setDraftRestored(false);
      await refreshProfile();
      logEvent(publish ? 'publish' : 'write_save').catch(() => {});
      if (freezeUsed) {
        await notify('🧊 보호권을 사용했어요', '어제 하루를 건너뛰었지만 연속 기록이 이어졌어요.');
      }
      if (newBadges.length > 0) {
        logEvent('badge_earned').catch(() => {});
        setCelebrationBadge(newBadges[0]);
      } else if (!freezeUsed) {
        await notify(publish ? '게시했어요.' : '새겼어요.', '오늘의 생각을 새겼어요.');
      }
    } catch (e: any) {
      // 도배 방지 쿨다운처럼 이유가 분명한 오류는 그 메시지를 그대로 보여준다.
      setError(e?.message || (publish ? '게시에 실패했어요. 다시 시도해주세요.' : '저장에 실패했어요. 다시 시도해주세요.'));
    } finally {
      setSaving(false);
    }
  }

  function handleShare() {
    if (!writing) return;
    share({ lines: writing.lines, createdAt: writing.createdAt, filename: `saegim-${writing.id}` });
  }

  async function handleUnpublish() {
    if (!writing || !writing.postId || !user) return;
    const ok = await confirm({
      title: '비공개로 전환할까요?',
      message: '다른 사람들의 피드에서 바로 사라져요.',
      confirmLabel: '비공개로',
    });
    if (!ok) return;

    setSaving(true);
    try {
      await unpublishPost(writing.postId, writing.id);
      await adjustPublicPostCount(user.uid, -1);
      setWriting({ ...writing, visibility: 'private', postId: null });
      await refreshProfile();
    } catch (e) {
      setError('변경에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const hasWritten = !!writing;

  return (
    <View style={{ flex: 1 }}>
      <TopBarButtons />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      <Text style={styles.appName}>새김</Text>

      {!prompt ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            {error ?? '오늘의 글감을 준비하고 있어요.\n잠시 후 다시 확인해주세요.'}
          </Text>
          {error && (
            <TouchableOpacity style={styles.retryButton} onPress={load}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <View style={styles.promptWrapper}>
            <View style={styles.promptCard}>
              <Text style={styles.promptLabel}>오늘의 글감</Text>
              <Text style={styles.promptTitle}>{prompt.title}</Text>
              {prompt.category && <Text style={styles.categoryChip}>{prompt.category}</Text>}
            </View>
            {!revealed && <PromptSticker onReveal={handleReveal} />}
          </View>

          {hasWritten && (
            <View style={styles.doneBadge}>
              <Text style={styles.doneBadgeText}>✓ 오늘의 생각을 새겼어요.</Text>
              <TouchableOpacity onPress={handleShare} accessibilityRole="button" accessibilityLabel="이미지로 공유하기">
                <Text style={styles.shareLink}>📤 이미지로 공유하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => tabNavigation.navigate('Feed')}
                accessibilityRole="button"
                accessibilityLabel="다른 사람들의 생각 보러가기"
              >
                <Text style={styles.shareLink}>💬 다른 사람들은 뭐라고 답했을까요?</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.guide}>이 글감을 보고 떠오른 생각을 새겨보세요.</Text>
          {!hasWritten && <Text style={styles.lengthReassurance}>한 줄이어도 충분해요.</Text>}
          {draftRestored && <Text style={styles.draftBanner}>📝 작성 중이던 내용을 불러왔어요.</Text>}
          {!hasWritten && profile && profile.streakCount > 0 && (profile.streakFreezes ?? 0) === 0 && (
            <Text style={styles.streakRiskBanner}>
              ⚠️ 오늘 새기지 않으면 🔥 {profile.streakCount}일 연속 기록이 끊겨요.
            </Text>
          )}

          <View style={styles.moodRow}>
            {MOOD_OPTIONS.map((m) => (
              <TouchableOpacity
                key={m.emoji}
                onPress={() => handleMoodPress(m.emoji)}
                style={[styles.moodButton, mood === m.emoji && styles.moodButtonSelected]}
                accessibilityRole="button"
                accessibilityLabel={`오늘 기분: ${m.label}`}
                accessibilityState={{ selected: mood === m.emoji }}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.writeInput}
            placeholder="이 글감을 보고 떠오른 생각을 적어보세요"
            placeholderTextColor={colors.textSoft}
            value={text}
            maxLength={WRITING_TOTAL_MAX_LENGTH}
            onChangeText={handleChangeText}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{text.length}/{WRITING_TOTAL_MAX_LENGTH}</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonOutline]}
              onPress={() => handleSave(false)}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="새기기, 비공개로 저장"
            >
              <Text style={styles.buttonOutlineText}>새기기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => handleSave(true)}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="게시하기, 공개로 저장"
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>게시하기</Text>}
            </TouchableOpacity>
          </View>

          {hasWritten && writing?.visibility === 'public' && (
            <TouchableOpacity onPress={handleUnpublish} disabled={saving}>
              <Text style={styles.unpublishLink}>비공개로 전환하기</Text>
            </TouchableOpacity>
          )}

          {profile && profile.streakCount > 0 && (
            <Text style={styles.streak}>🔥 {profile.streakCount}일째 생각을 새겼어요</Text>
          )}

          {memories.map(({ years, writing: memoryWriting }) => (
            <View key={years} style={styles.memoryCard}>
              <Text style={styles.memoryLabel}>🗓️ {years}년 전 오늘</Text>
              {memoryWriting.lines.map((line, i) => (
                <Text key={i} style={styles.memoryLine}>
                  {line}
                </Text>
              ))}
            </View>
          ))}
        </>
      )}
      <BackgroundMascot source={require('../assets/mascot-today.png')} />
      </ScrollView>
      <BadgeCelebrationModal badge={celebrationBadge} onClose={() => setCelebrationBadge(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  appName: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg },
  emptyText: { color: colors.textSoft, textAlign: 'center', lineHeight: 22 },
  retryButton: { marginTop: spacing.md, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary },
  retryButtonText: { color: colors.primary, fontWeight: '600' },
  promptWrapper: { marginBottom: spacing.md },
  promptCard: { backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: spacing.lg, minHeight: 150, justifyContent: 'center' },
  promptLabel: { color: colors.textSoft, fontSize: 13, marginBottom: spacing.xs },
  promptTitle: { color: colors.primary, fontSize: 26, fontWeight: '800' },
  categoryChip: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.sm,
  },
  doneBadge: { marginBottom: spacing.md },
  doneBadgeText: { color: colors.success, fontWeight: '600' },
  shareLink: { color: colors.primary, fontWeight: '600', marginTop: spacing.xs },
  offscreen: { position: 'absolute', top: 0, left: -9999 },
  guide: { color: colors.textSoft, marginBottom: spacing.xs },
  lengthReassurance: { color: colors.textSoft, fontSize: 12, fontStyle: 'italic', marginBottom: spacing.md },
  draftBanner: { color: colors.primary, fontSize: 12, marginBottom: spacing.sm },
  streakRiskBanner: { color: colors.danger, fontSize: 12, fontWeight: '600', marginBottom: spacing.sm },
  moodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  moodButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodButtonSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  moodEmoji: { fontSize: 18 },
  writeInput: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 140,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  counter: { color: colors.textSoft, fontSize: 12, textAlign: 'right', marginTop: spacing.xs },
  error: { color: colors.danger, marginVertical: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  button: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  buttonOutlineText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  unpublishLink: { color: colors.textSoft, textAlign: 'center', marginTop: spacing.lg },
  streak: { textAlign: 'center', marginTop: spacing.lg, fontSize: 15, color: colors.primary },
  memoryCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    padding: spacing.lg,
  },
  memoryLabel: { color: colors.textSoft, fontSize: 13, fontWeight: '700', marginBottom: spacing.sm },
  memoryLine: { color: colors.text, fontSize: 15, lineHeight: 22 },
});
