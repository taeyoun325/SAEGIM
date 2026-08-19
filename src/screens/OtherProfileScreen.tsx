import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, ScrollView } from 'react-native';
import Text from '../components/Text';
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, list] = await Promise.all([getUserProfile(userId), getUserPublicPosts(userId)]);
      setProfile(p);
      setPosts(list);
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
            {profile.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{profile.nickname.charAt(0)}</Text>
              </View>
            )}
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { paddingTop: spacing.lg },
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: colors.primary },
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
