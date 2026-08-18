import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../constants/theme';
import { DailyPrompt, Post } from '../types/models';
import { getTodayPrompt } from '../services/promptService';
import { getPromptFeed, FeedSort } from '../services/postService';
import { getLikedPostIds } from '../services/likeService';
import PostCard from '../components/PostCard';
import BackgroundMascot from '../components/BackgroundMascot';
import TopBarButtons from '../components/TopBarButtons';
import { RootStackParamList } from '../navigation/types';
import { DocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const { user, profile } = useAuth();
  const blockedIds = profile?.blockedUserIds ?? [];
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  // 카드마다 좋아요 여부를 따로 묻지 않도록 한 쪽 분량을 한 번에 조회해 들고 있는다.
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [sort, setSort] = useState<FeedSort>('latest');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (currentSort: FeedSort) => {
    setError(null);
    try {
      const p = await getTodayPrompt();
      setPrompt(p);
      if (p) {
        const page = await getPromptFeed(p.id, null, currentSort);
        setPosts(page.posts);
        setLastDoc(page.lastDoc);
        if (user) {
          setLikedPostIds(await getLikedPostIds(page.posts.map((post) => post.id), user.uid));
        }
      }
    } catch (e) {
      setError('피드를 불러오지 못했어요. 인터넷 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load(sort);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, sort])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(sort);
    setRefreshing(false);
  }

  function changeSort(next: FeedSort) {
    if (next === sort) return;
    setSort(next);
    setLoading(true);
  }

  function handleRandomBrowse() {
    const visible = posts.filter((p) => !blockedIds.includes(p.userId));
    if (visible.length === 0) return;
    const pick = visible[Math.floor(Math.random() * visible.length)];
    navigation.navigate('PostDetail', { postId: pick.id });
  }

  async function loadMore() {
    if (!prompt || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getPromptFeed(prompt.id, lastDoc, sort);
      setPosts((prev) => [...prev, ...page.posts]);
      setLastDoc(page.lastDoc);
      if (user) {
        // 새로 불러온 쪽만 조회해 기존 결과에 더한다.
        const nextLiked = await getLikedPostIds(page.posts.map((post) => post.id), user.uid);
        setLikedPostIds((prev) => new Set([...prev, ...nextLiked]));
      }
    } finally {
      setLoadingMore(false);
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
    <View style={styles.container}>
      <TopBarButtons />
      {prompt && (
        <View style={styles.header}>
          <Text style={styles.headerLabel}>오늘의 글감</Text>
          <Text style={styles.headerTitle}>{prompt.title}</Text>
          {prompt.category && <Text style={styles.categoryChip}>{prompt.category}</Text>}
          <View style={styles.sortRow}>
            <TouchableOpacity onPress={() => changeSort('latest')} style={[styles.sortChip, sort === 'latest' && styles.sortChipActive]}>
              <Text style={[styles.sortText, sort === 'latest' && styles.sortTextActive]}>최신순</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeSort('popular')} style={[styles.sortChip, sort === 'popular' && styles.sortChipActive]}>
              <Text style={[styles.sortText, sort === 'popular' && styles.sortTextActive]}>인기순</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRandomBrowse} style={styles.diceButton}>
              <Text style={styles.diceButtonText}>🎲 랜덤 둘러보기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorRow}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => load(sort)}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={posts.filter((p) => !blockedIds.includes(p.userId))}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>아직 새겨진 생각이 없어요.{'\n'}첫 생각을 새겨보세요.</Text>
          </View>
        }
        ListFooterComponent={
          <>
            {loadingMore && <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />}
            <BackgroundMascot source={require('../assets/mascot-feed.png')} />
          </>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            liked={likedPostIds.has(item.id)}
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            onPressAuthor={() => navigation.navigate('OtherProfile', { userId: item.userId })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerLabel: { color: colors.textSoft, fontSize: 13 },
  headerTitle: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  categoryChip: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.accentSoft,
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  sortRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  sortChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  sortChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortText: { color: colors.textSoft, fontSize: 13, fontWeight: '600' },
  sortTextActive: { color: '#fff' },
  diceButton: { marginLeft: 'auto', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  diceButtonText: { color: colors.textSoft, fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  error: { color: colors.danger, textAlign: 'center', marginBottom: spacing.sm },
  errorRow: { alignItems: 'center', paddingHorizontal: spacing.lg },
  retryButton: { marginBottom: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary },
  retryButtonText: { color: colors.primary, fontWeight: '600' },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSoft, textAlign: 'center', lineHeight: 22 },
});
