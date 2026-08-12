import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { getPendingReports, deleteReportedContent, dismissReport, ReportWithTarget } from '../services/adminService';
import { ReportReason } from '../types/models';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

const REASON_LABELS: Record<ReportReason, string> = {
  spam: '스팸',
  abuse: '욕설/괴롭힘',
  inappropriate: '부적절한 콘텐츠',
  ad: '광고',
  other: '기타',
};

export default function AdminReportsScreen() {
  const { user } = useAuth();
  const { confirm, notify } = useDialog();
  const [reports, setReports] = useState<ReportWithTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      setReports(await getPendingReports());
    } catch (e) {
      setError('신고 목록을 불러오지 못했어요. 관리자 권한을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleDelete(report: ReportWithTarget) {
    const ok = await confirm({
      title: '이 콘텐츠를 삭제할까요?',
      message: '작성자의 글이 즉시 삭제되며 되돌릴 수 없어요.',
      confirmLabel: '삭제하기',
      destructive: true,
    });
    if (!ok) return;

    setBusyId(report.id);
    try {
      await deleteReportedContent(report);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (e) {
      await notify('오류', '삭제에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(report: ReportWithTarget) {
    setBusyId(report.id);
    try {
      await dismissReport(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (e) {
      await notify('오류', '처리에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={reports}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>신고 관리</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.subtitle}>미처리 신고 {reports.length}건</Text>
        </View>
      }
      ListEmptyComponent={
        !error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>처리할 신고가 없어요.</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const deleted = item.targetLines === null && item.targetContent === null;
        return (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.badge}>{item.targetType === 'post' ? '게시물' : '댓글'}</Text>
              <Text style={styles.date}>{formatDisplayDate(timestampToDateString(item.createdAt))}</Text>
            </View>

            <Text style={styles.reason}>사유: {REASON_LABELS[item.reason] ?? item.reason}</Text>
            {item.detail ? <Text style={styles.detail}>“{item.detail}”</Text> : null}

            <View style={styles.contentBox}>
              {deleted ? (
                <Text style={styles.deletedText}>이미 삭제된 콘텐츠입니다.</Text>
              ) : item.targetType === 'post' ? (
                (item.targetLines ?? []).map((l, i) => (
                  <Text key={i} style={styles.contentLine}>
                    {l}
                  </Text>
                ))
              ) : (
                <Text style={styles.contentLine}>{item.targetContent}</Text>
              )}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonOutline]}
                onPress={() => handleDismiss(item)}
                disabled={busyId === item.id}
              >
                <Text style={styles.buttonOutlineText}>문제 없음</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={() => handleDelete(item)}
                disabled={busyId === item.id || deleted}
              >
                {busyId === item.id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonDangerText}>삭제</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary },
  subtitle: { color: colors.textSoft, marginTop: spacing.xs, marginBottom: spacing.md },
  error: { color: colors.danger, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  date: { color: colors.textSoft, fontSize: 12 },
  reason: { color: colors.danger, marginTop: spacing.sm, fontSize: 14 },
  detail: { color: colors.textSoft, marginTop: spacing.xs, fontSize: 13 },
  contentBox: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  contentLine: { color: colors.text, fontSize: 15, lineHeight: 22 },
  deletedText: { color: colors.textSoft, fontSize: 13 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  buttonOutline: { borderWidth: 1, borderColor: colors.border },
  buttonOutlineText: { color: colors.textSoft, fontWeight: '600' },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDangerText: { color: '#fff', fontWeight: '700' },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSoft },
});
