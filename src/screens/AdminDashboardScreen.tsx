import { useCallback, useState } from 'react';
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
import { getLoginCodeStats, LoginCodeSummary } from '../services/loginCodeService';
import { useDialog } from '../context/DialogContext';
import { DailyStats } from '../types/models';

interface Revisit {
  eligibleCount: number;
  revisitedCount: number;
  rate: number;
}

// 앱 실행 → 글감 확인 → 글쓰기 시작 → 게시 → 공유로 이어지는 핵심 흐름.
const FUNNEL_STEPS: { key: string; label: string }[] = [
  { key: 'app_open', label: '앱 실행' },
  { key: 'prompt_reveal', label: '글감 확인' },
  { key: 'write_start', label: '글쓰기 시작' },
  { key: 'write_save', label: '새기기(비공개)' },
  { key: 'publish', label: '게시하기' },
  { key: 'share_open', label: '공유 카드 열기' },
  { key: 'share_done', label: '공유 완료' },
  { key: 'post_save', label: '남의 글 저장' },
  { key: 'badge_earned', label: '배지 획득' },
];

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
  const [codeStats, setCodeStats] = useState<LoginCodeSummary[] | null>(null);
  const [loadingCodes, setLoadingCodes] = useState(false);

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

  async function loadCodeStats() {
    setLoadingCodes(true);
    try {
      setCodeStats(await getLoginCodeStats());
    } catch (e) {
      await notify('오류', '코드 발급 현황을 불러오지 못했어요.');
    } finally {
      setLoadingCodes(false);
    }
  }

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
            <StatCard label="활성 사용자" value={stats?.activeUserIds?.length ?? 0} />
            <StatCard label="글 작성" value={stats?.writingsCount ?? 0} />
            <StatCard label="댓글" value={stats?.commentsCount ?? 0} />
            <StatCard label="좋아요" value={stats?.likesCount ?? 0} />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>활동 사용자</Text>
          <Text style={styles.sectionHint}>앱을 연 사용자 기준(중복 제외).</Text>
          <View style={styles.grid}>
            <StatCard label="DAU (오늘)" value={activeUsers?.dau ?? 0} />
            <StatCard label="WAU (7일)" value={activeUsers?.wau ?? 0} />
            <StatCard label="MAU (30일)" value={activeUsers?.mau ?? 0} />
          </View>
          <Text style={[styles.sectionHint, { marginTop: spacing.sm }]}>글을 쓴 사용자만 따로 보면:</Text>
          <View style={styles.grid}>
            <StatCard label="작성 DAU" value={activeUsers?.writerDau ?? 0} />
            <StatCard label="작성 WAU" value={activeUsers?.writerWau ?? 0} />
            <StatCard label="작성 MAU" value={activeUsers?.writerMau ?? 0} />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>퍼널 (최근 30일)</Text>
          <Text style={styles.sectionHint}>어디에서 이탈하는지 보는 지표. 위에서 아래로 갈수록 줄어드는 게 정상이에요.</Text>
          {FUNNEL_STEPS.map((step) => {
            const count = activeUsers?.events?.[step.key] ?? 0;
            const base = activeUsers?.events?.[FUNNEL_STEPS[0].key] ?? 0;
            const pct = base > 0 ? Math.round((count / base) * 100) : 0;
            return (
              <View key={step.key} style={styles.funnelRow}>
                <Text style={styles.funnelLabel}>{step.label}</Text>
                <View style={styles.funnelBarTrack}>
                  <View style={[styles.funnelBarFill, { width: `${Math.min(pct, 100)}%` }]} />
                </View>
                <Text style={styles.funnelValue}>
                  {count}
                  {base > 0 ? ` · ${pct}%` : ''}
                </Text>
              </View>
            );
          })}

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

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={load}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="통계 새로고침"
      >
        <Text style={styles.refreshButtonText}>새로고침</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>로그인 코드 발급 현황</Text>
      <Text style={styles.sectionHint}>이메일 없는 사용자에게 나눠준 5자리 코드 중 실제로 로그인한 코드를 확인해요.</Text>
      {codeStats && (
        <View style={styles.grid}>
          <StatCard label="발급" value={codeStats.length} />
          <StatCard label="사용됨" value={codeStats.filter((c) => c.claimed).length} />
          <StatCard label="미사용" value={codeStats.filter((c) => !c.claimed).length} />
        </View>
      )}
      {codeStats && (
        <View style={styles.codeList}>
          {codeStats.map((c) => (
            <View key={c.code} style={styles.codeRow}>
              <Text style={styles.codeText}>{c.code}</Text>
              <Text style={c.claimed ? styles.codeClaimed : styles.codeUnclaimed}>
                {c.claimed ? `✓ ${c.nickname ?? '(닉네임 없음)'}` : '미사용'}
              </Text>
            </View>
          ))}
        </View>
      )}
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={loadCodeStats}
        disabled={loadingCodes}
        accessibilityRole="button"
        accessibilityLabel={codeStats ? '코드 현황 새로고침' : '코드 현황 보기'}
      >
        {loadingCodes ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.refreshButtonText}>{codeStats ? '코드 현황 새로고침' : '코드 현황 보기'}</Text>
        )}
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
            accessibilityRole="button"
            accessibilityLabel={`글감 카테고리 ${c}`}
            aria-selected={newCategory === c}
          >
            <Text style={[styles.categoryChipText, newCategory === c && styles.categoryChipTextSelected]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddPrompt}
        disabled={savingPrompt}
        accessibilityRole="button"
        accessibilityLabel="글감 추가"
      >
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
  funnelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  funnelLabel: { color: colors.text, fontSize: 12, width: 96 },
  funnelBarTrack: { flex: 1, height: 14, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  funnelBarFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.full },
  funnelValue: { color: colors.textSoft, fontSize: 11, width: 70, textAlign: 'right' },
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
  codeList: { marginTop: spacing.md, marginBottom: spacing.md },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  codeText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  codeClaimed: { color: colors.success, fontSize: 13 },
  codeUnclaimed: { color: colors.textSoft, fontSize: 13 },
});
