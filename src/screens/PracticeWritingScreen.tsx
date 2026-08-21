import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../constants/theme';
import { WRITING_TOTAL_MAX_LENGTH } from '../constants/config';
import { DailyPrompt } from '../types/models';
import { getPromptById, getRandomPastPrompt } from '../services/promptService';
import { createWriting, validateLines } from '../services/writingService';
import { syncUserCounts } from '../services/userService';
import { formatDisplayDate, promptIdToDateString } from '../utils/date';
import { savePracticeDraft, loadPracticeDraft, clearPracticeDraft } from '../services/draftService';
import { useAuth } from '../context/AuthContext';

// 오늘의 글감 흐름과 완전히 분리된 "연습" 공간이다. 놓친 날의 글감으로도,
// 그냥 더 쓰고 싶을 때도 부담 없이 써볼 수 있게 한다. 스트릭/보호권 로직은
// 오늘 새기기 전용이라 여기서는 건드리지 않는다 — 대신 저장 직후 실제 글
// 개수를 다시 세어(syncUserCounts) "내 새김" 통계에는 바로 반영한다.
export default function PracticeWritingScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  // 화면에 처음 들어왔을 때만 글감을 새로 뽑는다 — 다른 화면에 갔다가 돌아왔다고
  // 매번 새 글감으로 바뀌면 쓰던 내용과 글감이 같이 날아간 것처럼 보인다.
  const hasLoadedRef = useRef(false);

  // 매번 무작위 글감을 뽑는 화면이라, 쓰던 내용만 promptId로 저장해두면 다음에
  // 다른 글감이 뽑혀서 그 저장분을 다시 찾을 방법이 없다 — "그때 뽑혔던 글감"과
  // "쓰던 내용"을 함께 저장해뒀다가, 다음에 들어올 때 새로 뽑는 대신 그대로 복원한다.
  const loadPromptFresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPrompt(await getRandomPastPrompt());
    } catch {
      setError('글감을 불러오지 못했어요. 인터넷 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  const resumeOrLoadPrompt = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const draft = await loadPracticeDraft(user.uid);
      if (draft) {
        const draftPrompt = await getPromptById(draft.promptId);
        if (draftPrompt) {
          setPrompt(draftPrompt);
          setText(draft.lines.join('\n'));
          setDraftRestored(true);
          return;
        }
        // 저장해둔 글감을 못 찾으면(아주 드묾) 임시 저장을 지우고 새로 뽑는다.
        await clearPracticeDraft(user.uid);
      }
      setPrompt(await getRandomPastPrompt());
    } catch {
      setError('글감을 불러오지 못했어요. 인터넷 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;
      resumeOrLoadPrompt();
      setSaved(false);
    }, [resumeOrLoadPrompt])
  );

  // 서버에 저장되지 않은 상태에서 입력이 바뀌면 로컬에 임시 저장한다(디바운스).
  useEffect(() => {
    if (!user || !prompt || saved) return;
    const timer = setTimeout(() => {
      if (text.trim().length > 0) savePracticeDraft(user.uid, prompt.id, text.split('\n'));
    }, 500);
    return () => clearTimeout(timer);
  }, [text, user, prompt, saved]);

  async function handleReroll() {
    setText('');
    setSaved(false);
    setDraftRestored(false);
    if (user) await clearPracticeDraft(user.uid);
    await loadPromptFresh();
  }

  async function handleSave() {
    if (!user || !prompt) return;
    setError(null);
    const lines = text.split('\n');
    const { valid, reason } = validateLines(lines);
    if (!valid) {
      setError(reason ?? '내용을 확인해주세요.');
      return;
    }

    setSaving(true);
    try {
      await createWriting(user.uid, prompt.id, lines, 'private', prompt.category, null);
      if (profile) {
        await syncUserCounts(user.uid, profile);
        await refreshProfile();
      }
      await clearPracticeDraft(user.uid);
      setDraftRestored(false);
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || '저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>오늘의 새기기와 별개로, 지난 글감으로 편하게 더 써볼 수 있어요.</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : !prompt ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>{error ?? '글감을 불러오지 못했어요.'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={resumeOrLoadPrompt}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.promptCard}>
            <Text style={styles.promptLabel}>{formatDisplayDate(promptIdToDateString(prompt.id))}의 글감</Text>
            <Text style={styles.promptTitle}>{prompt.title}</Text>
            {prompt.category && <Text style={styles.categoryChip}>{prompt.category}</Text>}
          </View>
          <TouchableOpacity
            onPress={handleReroll}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="다른 글감으로 바꾸기"
          >
            <Text style={styles.rerollLink}>🔀 다른 글감으로 바꾸기</Text>
          </TouchableOpacity>

          {saved ? (
            <View style={styles.savedCard}>
              <Text style={styles.savedText}>✓ 새겼어요. "내 새김 관리"에서 확인할 수 있어요.</Text>
              <TouchableOpacity
                style={styles.rerollButton}
                onPress={handleReroll}
                accessibilityRole="button"
                accessibilityLabel="다른 글감으로 더 써보기"
              >
                <Text style={styles.rerollButtonText}>다른 글감으로 더 써보기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {draftRestored && <Text style={styles.draftBanner}>📝 작성 중이던 내용을 불러왔어요.</Text>}
              <TextInput
                style={styles.writeInput}
                placeholder="이 글감을 보고 떠오른 생각을 적어보세요"
                placeholderTextColor={colors.textSoft}
                value={text}
                maxLength={WRITING_TOTAL_MAX_LENGTH}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.counter}>{text.length}/{WRITING_TOTAL_MAX_LENGTH}</Text>
              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="새기기, 비공개로 저장"
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>새기기</Text>}
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  hint: { color: colors.textSoft, fontSize: 13, marginBottom: spacing.md, lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textSoft, textAlign: 'center', lineHeight: 22 },
  retryButton: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary },
  retryButtonText: { color: colors.primary, fontWeight: '600' },
  promptCard: { backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: spacing.lg, minHeight: 130, justifyContent: 'center' },
  promptLabel: { color: colors.textSoft, fontSize: 13, marginBottom: spacing.xs },
  promptTitle: { color: colors.primary, fontSize: 24, fontWeight: '800' },
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
  rerollLink: { color: colors.primary, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.lg },
  draftBanner: { color: colors.primary, fontSize: 12, marginBottom: spacing.sm },
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
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  savedCard: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  savedText: { color: colors.success, fontWeight: '600', textAlign: 'center', marginBottom: spacing.md },
  rerollButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary },
  rerollButtonText: { color: colors.primary, fontWeight: '600' },
});
