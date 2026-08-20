import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
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
import { matchesMutedKeyword } from '../utils/textFilter';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SavedPostsScreen() {
  const navigation = useNavigation<Nav>();
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const likedPostIds = useLikedPosts(posts, user?.uid);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // 저장한 글이 쌓일수록 예전에 저장해둔 특정 글을 다시 찾기 어려워진다
  // ("저장은 쉬운데 나중에 찾기가 어렵다"는 게 북마크 기능의 흔한 약점이다).
  // 차단/키워드 뮤트는 피드/캘린더/댓글/알림함과 마찬가지로 여기서도 적용돼야 한다 —
  // 저장해둔 뒤에 그 사람을 차단하거나 그 단어를 뮤트했다면 더 이상 보이면 안 된다
  // (차단은 이미 처리돼 있었지만, 키워드 뮤트는 이 화면만 빠져 있었다).
  const filtered = useMemo(() => {
    const blockedIds = profile?.blockedUserIds ?? [];
    const mutedKeywords = profile?.mutedKeywords ?? [];
    const visible = posts.filter(
      (p) => !blockedIds.includes(p.userId) && !matchesMutedKeyword(p.lines, mutedKeywords)
    );
    const q = query.trim();
    if (!q) return visible;
    return visible.filter((p) => p.lines.some((l) => l.includes(q)));
  }, [posts, query, profile?.blockedUserIds, profile?.mutedKeywords]);

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
      ListHeaderComponent={
        posts.length > 0 ? (
          <TextInput
            style={styles.searchInput}
            placeholder="저장한 글 내용 검색"
            placeholderTextColor={colors.textSoft}
            value={query}
            onChangeText={setQuery}
          />
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {query
              ? '검색 결과가 없어요.'
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
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSoft, textAlign: 'center', lineHeight: 22 },
});
