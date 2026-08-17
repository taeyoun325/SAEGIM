import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../constants/theme';
import { getTodayStats, getRevisitRate } from '../services/adminService';
import { DailyStats } from '../types/models';

interface Revisit {
  eligibleCount: number;
  revisitedCount: number;
  rate: number;
}

export default function AdminDashboardScreen() {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [revisit7, setRevisit7] = useState<Revisit | null>(null);
  const [revisit30, setRevisit30] = useState<Revisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [today, r7, r30] = await Promise.all([getTodayStats(), getRevisitRate(7), getRevisitRate(30)]);
      setStats(today);
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

          <View style={styles.grid}>
            <StatCard label="7일 재방문율" value={revisit7 ? `${Math.round(revisit7.rate * 100)}%` : '-'} sub={revisit7 ? `${revisit7.revisitedCount}/${revisit7.eligibleCount}명` : undefined} />
            <StatCard label="30일 재방문율" value={revisit30 ? `${Math.round(revisit30.rate * 100)}%` : '-'} sub={revisit30 ? `${revisit30.revisitedCount}/${revisit30.eligibleCount}명` : undefined} />
          </View>
        </>
      )}

      <TouchableOpacity style={styles.refreshButton} onPress={load} disabled={loading}>
        <Text style={styles.refreshButtonText}>새로고침</Text>
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
});
