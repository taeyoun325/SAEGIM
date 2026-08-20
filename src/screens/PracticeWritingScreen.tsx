import { useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, spacing, radius } from '../constants/theme';
import { WRITING_TOTAL_MAX_LENGTH } from '../constants/config';
import { DailyPrompt } from '../types/models';
import { getRandomPastPrompt } from '../services/promptService';
import { createWriting, validateLines } from '../services/writingService';
import { syncUserCounts } from '../services/userService';
import { formatDisplayDate, promptIdToDateString } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';

// 오늘의 글감 흐름과 완전히 분리된 "연습" 공간이다. 놓친 날의 글감으로도,
// 그냥 더 쓰고 싶을 때도 부담 없이 써볼 수 있게 한다. 스트릭/보호권 로직은
// 오늘 새기기 전용이라 여기서는 건드리지 않는다 — 대신 저장 직후 실제 글
// 개수를 다시 세어(syncUserCounts) "내 새김" 통계에는 바로 반영한다.
export default function PracticeWritingScreen() {
  const navigation = useNavigation();
  const { user, profile, refreshProfile } = useAuth();
  const { notify } = useDialog();
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadPrompt = useCallback(async () => {
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

  useFocusEffect(
    useCallback(() => {
      loadPrompt();
      setText('');
      setSaved(false);
    }, [loadPrompt])
  );

  async function handleReroll() {
    setText('');
    setSaved(false);
    await loadPrompt();
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
            onPress={loadPrompt}
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
