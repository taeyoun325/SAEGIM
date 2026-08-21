import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../constants/theme';
import { Post } from '../types/models';
import { getSavedPosts } from '../services/saveService';
import PostCard from '../components/PostCard';
import { useAuth } from '../context/AuthContext';
import { useLikedPosts } from '../hooks/useLikedPosts';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SavedPostsScreen() {
  const navigation = useNavigation<Nav>();
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const likedPostIds = useLikedPosts(posts, user?.uid);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // 저장한 글이 쌓일수록 예전에 저장해둔 특정 글을 다시 찾기 어려워진다
  // ("저장은 쉬운데 나중에 찾기가 어렵다"는 게 북마크 기능의 흔한 약점이다).
  // 차단은 피드/캘린더/댓글/알림함과 마찬가지로 여기서도 적용돼야 한다 —
  // 저장해둔 뒤에 그 사람을 차단했다면 더 이상 보이면 안 된다.
  const filtered = useMemo(() => {
    const blockedIds = profile?.blockedUserIds ?? [];
    let visible = posts.filter((p) => !blockedIds.includes(p.userId));
    if (categoryFilter) visible = visible.filter((p) => p.category === categoryFilter);
    const q = query.trim();
    if (!q) return visible;
    return visible.filter((p) => p.lines.some((l) => l.includes(q)));
  }, [posts, query, categoryFilter, profile?.blockedUserIds]);

  const usedCategories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [posts]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setPosts(await getSavedPosts(user.uid));
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
      data={filtered}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        posts.length > 0 ? (
          <View>
            <TextInput
              style={styles.searchInput}
              placeholder="저장한 글 내용 검색"
              placeholderTextColor={colors.textSoft}
              value={query}
              onChangeText={setQuery}
            />
            {usedCategories.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                <TouchableOpacity
                  style={[styles.categoryChip, categoryFilter === null && styles.categoryChipActive]}
                  onPress={() => setCategoryFilter(null)}
                  accessibilityRole="button"
                  accessibilityLabel="글감 카테고리 전체 보기"
                  aria-selected={categoryFilter === null}
                >
                  <Text style={[styles.categoryChipText, categoryFilter === null && styles.categoryChipTextActive]}>전체 카테고리</Text>
                </TouchableOpacity>
                {usedCategories.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.categoryChip, categoryFilter === c && styles.categoryChipActive]}
                    onPress={() => setCategoryFilter((prev) => (prev === c ? null : c))}
                    accessibilityRole="button"
                    accessibilityLabel={`글감 카테고리 ${c}만 보기`}
                    aria-selected={categoryFilter === c}
                  >
                    <Text style={[styles.categoryChipText, categoryFilter === c && styles.categoryChipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {query || categoryFilter
              ? '조건에 맞는 글이 없어요.'
              : posts.length > 0
                ? '저장한 글이 모두 차단했거나 뮤트한 내용이라 보이지 않아요.'
                : '저장한 글이 없어요.\n마음에 드는 글을 저장해보세요.'}
          </Text>
        </View>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  searchInput: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    color: colors.text,
  },
  categoryRow: { gap: spacing.xs, marginBottom: spacing.md },
  categoryChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
  categoryChipTextActive: { color: '#fff' },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSoft, textAlign: 'center', lineHeight: 22 },
});
