import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { getMyWritings } from '../services/writingService';
import { getPromptById } from '../services/promptService';
import { getPromptFeed } from '../services/postService';
import { Writing, DailyPrompt, Post } from '../types/models';
import { RootStackParamList } from '../navigation/types';
import PostCard from '../components/PostCard';
import { useLikedPosts } from '../hooks/useLikedPosts';
import BackgroundMascot from '../components/BackgroundMascot';
import TopBarButtons from '../components/TopBarButtons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function CalendarScreen() {
  const { user, profile } = useAuth();
  const navigation = useNavigation<Nav>();
  const [cursor, setCursor] = useState(() => new Date());
  const [myWritings, setMyWritings] = useState<Record<string, Writing>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<DailyPrompt | null>(null);
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);
  const likedPostIds = useLikedPosts(popularPosts, user?.uid);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await getMyWritings(user.uid);
      const byPromptId: Record<string, Writing> = {};
      list.forEach((w) => {
        byPromptId[w.promptId] = w;
      });
      setMyWritings(byPromptId);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month, daysInMonth]);

  const monthWrittenCount = useMemo(() => {
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (myWritings[promptIdFor(d)]) count++;
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWritings, year, month, daysInMonth]);

  function promptIdFor(day: number) {
    return `${year}${pad(month + 1)}${pad(day)}`;
  }

  async function openDay(day: number) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    const promptId = promptIdFor(day);
    setSelectedDate(dateStr);
    setDetailLoading(true);
    try {
      const [prompt, feed] = await Promise.all([getPromptById(promptId), getPromptFeed(promptId, null, 'popular')]);
      setSelectedPrompt(prompt);
      const blockedIds = profile?.blockedUserIds ?? [];
      setPopularPosts(feed.posts.filter((p) => !blockedIds.includes(p.userId)).slice(0, 5));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeModal() {
    setSelectedDate(null);
    setSelectedPrompt(null);
    setPopularPosts([]);
  }

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }, []);

  const myWritingForSelected = selectedPrompt ? myWritings[selectedPrompt.id] : null;

  const now = new Date();
  const todayPromptId = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const todayWriting = myWritings[todayPromptId];

  return (
    <View style={{ flex: 1 }}>
      <TopBarButtons />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setCursor(new Date(year, month - 1, 1))}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
        >
          <Text style={styles.nav}>‹</Text>
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <Text style={styles.title}>{year}년 {month + 1}월</Text>
          {!loading && <Text style={styles.monthSummary}>이 달에 {monthWrittenCount}일 새겼어요</Text>}
        </View>
        <TouchableOpacity
          onPress={() => setCursor(new Date(year, month + 1, 1))}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
        >
          <Text style={styles.nav}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <View style={styles.grid}>
          {days.map((day, i) => {
            if (day === null) return <View key={i} style={styles.cell} />;
            const promptId = promptIdFor(day);
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
            const hasWriting = !!myWritings[promptId];
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            const isPast = dateStr < todayStr;
            // 작성 여부/오늘 여부를 색으로만 구분하고 있어서, 스크린리더에는 날짜 숫자만
            // 읽혀 정작 가장 중요한 정보(썼는지 안 썼는지)가 전달되지 않았다.
            // 같은 정보를 말로 풀어 라벨에 담는다.
            const statusLabel = isFuture ? '아직 오지 않음' : hasWriting ? '작성함' : '작성 안 함';
            return (
              <TouchableOpacity
                key={i}
                style={[styles.cell, isFuture && styles.cellFuture]}
                onPress={() => openDay(day)}
                disabled={isFuture}
                accessibilityRole="button"
                accessibilityLabel={`${month + 1}월 ${day}일${isToday ? ', 오늘' : ''}, ${statusLabel}`}
              >
                <View
                  style={[
                    styles.dayCircle,
                    hasWriting && styles.writtenCircle,
                    isToday && styles.todayBorder,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isToday && styles.todayText,
                      isPast && !hasWriting && styles.pastEmptyText,
                      hasWriting && styles.writtenText,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!loading && (
        <View style={styles.todaySection}>
          <Text style={styles.sectionLabel}>오늘 새긴 생각</Text>
          {todayWriting ? (
            <View style={styles.myWritingCard}>
              {todayWriting.lines.map((l, idx) => (
                <Text key={idx} style={styles.myWritingLine}>
                  {l}
                </Text>
              ))}
              <Text style={todayWriting.visibility === 'public' ? styles.publicBadge : styles.privateBadge}>
                {todayWriting.visibility === 'public' ? '🌐 공개' : '🔒 비공개'}
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>아직 오늘의 생각을 새기지 않았어요.{'\n'}오늘 탭에서 새겨보세요.</Text>
          )}
        </View>
      )}

      <Modal visible={!!selectedDate} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
              <Text style={styles.sheetDate}>{selectedDate?.replace(/-/g, '.')}</Text>
              {detailLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
              ) : (
                <>
                  <Text style={styles.sheetPrompt}>오늘의 글감: {selectedPrompt?.title ?? '없음'}</Text>

                  <Text style={styles.sectionLabel}>내가 새긴 생각</Text>
                  {myWritingForSelected ? (
                    <View style={styles.myWritingCard}>
                      {myWritingForSelected.lines.map((l, idx) => (
                        <Text key={idx} style={styles.myWritingLine}>{l}</Text>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>이 날은 새긴 생각이 없어요.</Text>
                  )}

                  <Text style={styles.sectionLabel}>이 날의 인기글</Text>
                  {popularPosts.length === 0 ? (
                    <Text style={styles.emptyText}>공개된 글이 없어요.</Text>
                  ) : (
                    popularPosts.map((p, i) => (
                      <PostCard
                        key={p.id}
                        post={p}
                        liked={likedPostIds.has(p.id)}
                        onPress={() => {
                          closeModal();
                          navigation.navigate('PostDetail', { postId: p.id, focusComments: true });
                        }}
                        rank={i < 3 ? ((i + 1) as 1 | 2 | 3) : undefined}
                      />
                    ))
                  )}
                </>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeModal}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Text style={styles.closeButtonText}>닫기</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <BackgroundMascot source={require('../assets/mascot-calendar.png')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  todaySection: { marginTop: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  nav: { fontSize: 24, color: colors.primary, paddingHorizontal: spacing.md },
  titleCol: { alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.primary },
  monthSummary: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: colors.textSoft, fontSize: 12, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellFuture: { opacity: 0.35 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  writtenCircle: { backgroundColor: colors.accent },
  todayBorder: { borderWidth: 2, borderColor: colors.primary },
  dayText: { color: colors.text, fontSize: 14 },
  writtenText: { color: '#fff', fontWeight: '700' },
  pastEmptyText: { color: colors.textSoft },
  todayText: { color: colors.primary, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: '80%' },
  sheetDate: { fontSize: 20, fontWeight: '800', color: colors.primary },
  sheetPrompt: { color: colors.textSoft, marginTop: spacing.xs, marginBottom: spacing.md },
  sectionLabel: { fontWeight: '700', color: colors.primary, marginTop: spacing.md, marginBottom: spacing.sm },
  myWritingCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  myWritingLine: { color: colors.text, fontSize: 15, lineHeight: 22 },
  publicBadge: { color: colors.success, marginTop: spacing.sm, fontWeight: '600', fontSize: 13 },
  privateBadge: { color: colors.textSoft, marginTop: spacing.sm, fontWeight: '600', fontSize: 13 },
  emptyText: { color: colors.textSoft },
  closeButton: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.md },
  closeButtonText: { color: colors.textSoft, fontWeight: '600' },
});
