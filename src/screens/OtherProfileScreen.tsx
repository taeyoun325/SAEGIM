import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import Text from '../components/Text';
import Avatar from '../components/Avatar';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, radius } from '../constants/theme';
import { Post, UserProfile } from '../types/models';
import { getUserPublicPosts } from '../services/postService';
import { getUserProfile, blockUser } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import PostCard from '../components/PostCard';
import { useLikedPosts } from '../hooks/useLikedPosts';
import { BADGE_DEFS } from '../constants/badges';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OtherProfileScreen() {
  const route = useRoute();
  const navigation = useNavigation<Nav>();
  const { userId } = route.params as { userId: string };
  const { user, refreshProfile } = useAuth();
  const { confirm, notify } = useDialog();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const likedPostIds = useLikedPosts(posts, user?.uid);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [p, list] = await Promise.all([getUserProfile(userId), getUserPublicPosts(userId)]);
      setProfile(p);
      setPosts(list);
      // 계정을 탈퇴했거나 존재한 적 없는 userId일 수 있다 — 예전 댓글/글에 남은
      // 작성자 링크를 통해서도 들어올 수 있으므로 무한 로딩 대신 안내가 필요하다.
      if (!p) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleBlock() {
    if (!user) return;
    const ok = await confirm({
      title: '이 사용자를 차단할까요?',
      message: '차단하면 이 사용자의 글이 더 이상 보이지 않아요.',
      confirmLabel: '차단',
      destructive: true,
    });
    if (!ok) return;
    try {
      await blockUser(user.uid, userId);
      await refreshProfile();
      navigation.goBack();
    } catch (e) {
      await notify('오류', '차단에 실패했어요.');
    }
  }

  if (notFound) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>이 사용자를 찾을 수 없어요.{'\n'}탈퇴했거나, 링크가 잘못됐을 수 있어요.</Text>
        <TouchableOpacity
          style={styles.notFoundButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Text style={styles.notFoundButtonText}>뒤로 가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.identityRow}>
            <Avatar profile={profile} size={56} />
            <View style={styles.identityText}>
              <Text style={styles.nickname}>{profile.nickname}</Text>
              <Text style={styles.joined}>가입일 {formatDisplayDate(timestampToDateString(profile.createdAt))}</Text>
            </View>
          </View>
          {profile.bio && <Text style={styles.bioText}>{profile.bio}</Text>}
          <TouchableOpacity
            onPress={handleBlock}
            accessibilityRole="button"
            accessibilityLabel={`${profile.nickname} 차단하기`}
          >
            <Text style={styles.blockText}>차단하기</Text>
          </TouchableOpacity>
          {profile.earnedBadgeIds && profile.earnedBadgeIds.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>배지</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                {BADGE_DEFS.filter((b) => profile.earnedBadgeIds.includes(b.id)).map((b) => (
                  <View key={b.id} style={styles.badgeChip}>
                    <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                    <Text style={styles.badgeName}>{b.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
          <Text style={styles.sectionTitle}>공개한 글</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>공개한 글이 없어요.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <PostCard
          post={item}
          liked={likedPostIds.has(item.id)}
          onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  notFoundText: { color: colors.textSoft, textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  notFoundButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary },
  notFoundButtonText: { color: colors.primary, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { paddingTop: spacing.lg },
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  identityText: { marginLeft: spacing.md, flex: 1 },
  nickname: { fontSize: 22, fontWeight: '800', color: colors.primary },
  joined: { color: colors.textSoft, marginTop: spacing.xs, fontSize: 12 },
  bioText: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  blockText: { color: colors.danger, marginTop: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  badgeRow: { gap: spacing.sm, paddingBottom: spacing.xs },
  badgeChip: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 76,
  },
  badgeEmoji: { fontSize: 24 },
  badgeName: { fontSize: 11, color: colors.primary, marginTop: spacing.xs, textAlign: 'center' },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textSoft },
});
