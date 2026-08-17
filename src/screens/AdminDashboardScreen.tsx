import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../constants/theme';
import {
  getTodayStats,
  getRevisitRate,
  getActiveUserMetrics,
  getFirstWriteConversion,
  ActiveUserMetrics,
} from '../services/adminService';
import { createPrompt } from '../services/promptService';
import { PROMPT_CATEGORIES } from '../constants/promptPool';
import { useDialog } from '../context/DialogContext';
import { DailyStats } from '../types/models';

interface Revisit {
  eligibleCount: number;
  revisitedCount: number;
  rate: number;
}

export default function AdminDashboardScreen() {
  const { notify } = useDialog();
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUserMetrics | null>(null);
  const [conversion, setConversion] = useState<{ total: number; wrote: number; rate: number } | null>(null);
  const [revisit7, setRevisit7] = useState<Revisit | null>(null);
  const [revisit30, setRevisit30] = useState<Revisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState(PROMPT_CATEGORIES[0]);
  const [savingPrompt, setSavingPrompt] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [today, active, conv, r7, r30] = await Promise.all([
        getTodayStats(),
        getActiveUserMetrics(),
        getFirstWriteConversion(),
        getRevisitRate(7),
        getRevisitRate(30),
      ]);
      setStats(today);
      setActiveUsers(active);
      setConversion(conv);
      setRevisit7(r7);
      setRevisit30(r30);
    } catch (e) {
      setError('통계를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleAddPrompt() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate.trim())) {
      await notify('오류', '날짜는 YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }
    if (!newTitle.trim()) {
      await notify('오류', '글감 제목을 입력해주세요.');
      return;
    }
    setSavingPrompt(true);
    try {
      await createPrompt(newDate.trim(), newTitle.trim(), newCategory);
      await notify('추가했어요', `${newDate.trim()} 글감으로 "${newTitle.trim()}"을(를) 등록했어요.`);
      setNewDate('');
      setNewTitle('');
    } catch (e) {
      await notify('오류', '글감 추가에 실패했어요.');
    } finally {
      setSavingPrompt(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>통계 대시보드</Text>
      <Text style={styles.subtitle}>오늘 ({stats?.date ?? '...'})</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <>
          <View style={styles.grid}>
            <StatCard label="신규 가입" value={stats?.newSignups ?? 0} />
            <StatCard label="활성 사용자" value={stats?.activeUserIds.length ?? 0} />
            <StatCard label="글 작성" value={stats?.writingsCount ?? 0} />
            <StatCard label="댓글" value={stats?.commentsCount ?? 0} />
            <StatCard label="좋아요" value={stats?.likesCount ?? 0} />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>활동 사용자</Text>
          <Text style={styles.sectionHint}>글을 쓴 사용자 기준(중복 제외). 앱을 열기만 한 사용자는 포함되지 않아요.</Text>
          <View style={styles.grid}>
            <StatCard label="DAU (오늘)" value={activeUsers?.dau ?? 0} />
            <StatCard label="WAU (7일)" value={activeUsers?.wau ?? 0} />
            <StatCard label="MAU (30일)" value={activeUsers?.mau ?? 0} />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>전환 · 유지</Text>
          <View style={styles.grid}>
            <StatCard
              label="첫 글 작성률"
              value={conversion ? `${Math.round(conversion.rate * 100)}%` : '-'}
              sub={conversion ? `${conversion.wrote}/${conversion.total}명` : undefined}
            />
            <StatCard label="7일 재방문율" value={revisit7 ? `${Math.round(revisit7.rate * 100)}%` : '-'} sub={revisit7 ? `${revisit7.revisitedCount}/${revisit7.eligibleCount}명` : undefined} />
            <StatCard label="30일 재방문율" value={revisit30 ? `${Math.round(revisit30.rate * 100)}%` : '-'} sub={revisit30 ? `${revisit30.revisitedCount}/${revisit30.eligibleCount}명` : undefined} />
          </View>
        </>
      )}

      <TouchableOpacity style={styles.refreshButton} onPress={load} disabled={loading}>
        <Text style={styles.refreshButtonText}>새로고침</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>글감 추가</Text>
      <TextInput
        style={styles.input}
        placeholder="날짜 (YYYY-MM-DD)"
        placeholderTextColor={colors.textSoft}
        value={newDate}
        onChangeText={setNewDate}
      />
      <TextInput
        style={styles.input}
        placeholder="글감 제목"
        placeholderTextColor={colors.textSoft}
        value={newTitle}
        onChangeText={setNewTitle}
      />
      <View style={styles.categoryRow}>
        {PROMPT_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.categoryChip, newCategory === c && styles.categoryChipSelected]}
            onPress={() => setNewCategory(c)}
          >
            <Text style={[styles.categoryChipText, newCategory === c && styles.categoryChipTextSelected]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.addButton} onPress={handleAddPrompt} disabled={savingPrompt}>
        {savingPrompt ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>글감 추가</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
      {sub && <Text style={styles.cardSub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary },
  subtitle: { color: colors.textSoft, marginTop: spacing.xs, marginBottom: spacing.lg },
  error: { color: colors.danger, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    flexGrow: 1,
    minWidth: 100,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  cardValue: { fontSize: 24, fontWeight: '800', color: colors.primary },
  cardLabel: { color: colors.textSoft, fontSize: 12, marginTop: spacing.xs },
  cardSub: { color: colors.textSoft, fontSize: 10, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  refreshButton: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  refreshButtonText: { color: colors.primary, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  sectionHint: { color: colors.textSoft, fontSize: 11, marginTop: -spacing.xs, marginBottom: spacing.sm, lineHeight: 16 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  categoryChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  categoryChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { color: colors.textSoft, fontSize: 13, fontWeight: '600' },
  categoryChipTextSelected: { color: '#fff' },
  addButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700' },
});
