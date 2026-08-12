import React, { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../constants/theme';
import { WRITING_LINE_COUNT, WRITING_LINE_MAX_LENGTH } from '../constants/config';
import { DailyPrompt, Writing } from '../types/models';
import { getTodayPrompt } from '../services/promptService';
import { createWriting, getMyWritingForPrompt, validateLines, updateWritingContent } from '../services/writingService';
import { publishWriting, unpublishPost, updatePostContent } from '../services/postService';
import { recordTodayWriting, adjustPublicPostCount } from '../services/userService';
import { saveDraft, loadDraft, clearDraft, isPromptRevealed, markPromptRevealed } from '../services/draftService';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { todayDateString } from '../utils/date';
import PromptSticker from '../components/PromptSticker';
import BackgroundMascot from '../components/BackgroundMascot';

export default function TodayScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { confirm, notify } = useDialog();
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [writing, setWriting] = useState<Writing | null>(null);
  const [lines, setLines] = useState<string[]>(Array(WRITING_LINE_COUNT).fill(''));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

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
        if (w) {
          setLines([...w.lines, ...Array(WRITING_LINE_COUNT - w.lines.length).fill('')].slice(0, WRITING_LINE_COUNT));
        } else {
          const draft = await loadDraft(user.uid, p.id);
          if (draft) setLines([...draft, ...Array(WRITING_LINE_COUNT - draft.length).fill('')].slice(0, WRITING_LINE_COUNT));
        }
      }
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
      const hasContent = lines.some((l) => l.trim().length > 0);
      if (hasContent) saveDraft(user.uid, prompt.id, lines);
    }, 500);
    return () => clearTimeout(timer);
  }, [lines, user, prompt, writing]);

  async function handleReveal() {
    setRevealed(true);
    if (user && prompt) await markPromptRevealed(user.uid, prompt.id);
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSave(publish: boolean) {
    if (!user || !prompt) return;
    setError(null);

    const { valid, reason } = validateLines(lines);
    if (!valid) {
      setError(reason ?? '내용을 확인해주세요.');
      return;
    }

    if (publish) {
      const ok = await confirm({
        title: '이 글을 공개할까요?',
        message: '다른 사람들이 오늘의 글감 페이지에서 볼 수 있어요.',
        confirmLabel: '게시하기',
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      let currentWriting = writing;
      const cleanLines = lines.filter((l) => l.trim().length > 0);

      if (!currentWriting) {
        const id = await createWriting(user.uid, prompt.id, lines, 'private');
        await recordTodayWriting(user.uid, todayDateString());
        currentWriting = {
          id,
          userId: user.uid,
          promptId: prompt.id,
          lines: cleanLines,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          visibility: 'private',
          postId: null,
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
      await refreshProfile();
      await notify(publish ? '게시했어요.' : '새겼어요.', '오늘의 생각을 새겼어요.');
    } catch (e) {
      setError(publish ? '게시에 실패했어요. 다시 시도해주세요.' : '저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.appName}>새김</Text>

      {!prompt ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>오늘의 글감을 준비하고 있어요.{'\n'}잠시 후 다시 확인해주세요.</Text>
        </View>
      ) : (
        <>
          <View style={styles.promptWrapper}>
            <View style={styles.promptCard}>
              <Text style={styles.promptLabel}>오늘의 글감</Text>
              <Text style={styles.promptTitle}>{prompt.title}</Text>
            </View>
            {!revealed && <PromptSticker onReveal={handleReveal} />}
          </View>

          {hasWritten && (
            <View style={styles.doneBadge}>
              <Text style={styles.doneBadgeText}>✓ 오늘의 생각을 새겼어요.</Text>
            </View>
          )}

          <Text style={styles.guide}>이 글감을 보고 떠오른 생각을 새겨보세요.</Text>

          {lines.map((line, i) => (
            <TextInput
              key={i}
              style={styles.lineInput}
              placeholder={`${['첫', '두', '세'][i]} 번째 줄`}
              placeholderTextColor={colors.textSoft}
              value={line}
              maxLength={WRITING_LINE_MAX_LENGTH}
              onChangeText={(text) => {
                const next = [...lines];
                next[i] = text;
                setLines(next);
              }}
            />
          ))}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={() => handleSave(false)} disabled={saving}>
              <Text style={styles.buttonOutlineText}>새기기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => handleSave(true)} disabled={saving}>
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
        </>
      )}
      <BackgroundMascot source={require('../assets/mascot-today.png')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  appName: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg },
  emptyText: { color: colors.textSoft, textAlign: 'center', lineHeight: 22 },
  promptWrapper: { marginBottom: spacing.md },
  promptCard: { backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: spacing.lg, minHeight: 150, justifyContent: 'center' },
  promptLabel: { color: colors.textSoft, fontSize: 13, marginBottom: spacing.xs },
  promptTitle: { color: colors.primary, fontSize: 26, fontWeight: '800' },
  doneBadge: { marginBottom: spacing.md },
  doneBadgeText: { color: colors.success, fontWeight: '600' },
  guide: { color: colors.textSoft, marginBottom: spacing.md },
  lineInput: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, marginVertical: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  button: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  buttonOutlineText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  unpublishLink: { color: colors.textSoft, textAlign: 'center', marginTop: spacing.lg },
  streak: { textAlign: 'center', marginTop: spacing.lg, fontSize: 15, color: colors.primary },
});
