import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../constants/theme';
import { Post } from '../types/models';
import { getUserPublicPosts } from '../services/postService';
import { BADGE_DEFS } from '../constants/badges';
import PostCard from '../components/PostCard';
import BackgroundMascot from '../components/BackgroundMascot';
import SettingsGearButton from '../components/SettingsGearButton';
import { RootStackParamList } from '../navigation/types';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { user, profile } = useAuth();
  const navigation = useNavigation<Nav>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await getUserPublicPosts(user.uid);
      setPosts(list);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SettingsGearButton />
      <FlatList
      style={styles.container}
      data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.nickname}>{profile.nickname}</Text>
            <Text style={styles.joined}>가입일 {formatDisplayDate(timestampToDateString(profile.createdAt))}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.writingCount}</Text>
                <Text style={styles.statLabel}>새긴 생각</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.publicPostCount}</Text>
                <Text style={styles.statLabel}>공개한 생각</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>🔥 {profile.streakCount}</Text>
                <Text style={styles.statLabel}>연속 새김</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>배지</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
              {BADGE_DEFS.map((b) => {
                const owned = profile.earnedBadgeIds?.includes(b.id);
                return (
                  <View key={b.id} style={[styles.badgeChip, !owned && styles.badgeChipLocked]}>
                    <Text style={[styles.badgeEmoji, !owned && styles.badgeEmojiLocked]}>{b.emoji}</Text>
                    <Text style={[styles.badgeName, !owned && styles.badgeNameLocked]}>{b.name}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <Text style={styles.sectionTitle}>내가 공개한 생각</Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>아직 공개한 생각이 없어요.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <PostCard post={item} onPress={() => navigation.navigate('PostDetail', { postId: item.id })} />}
        ListFooterComponent={<BackgroundMascot source={require('../assets/mascot-profile.png')} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { paddingTop: spacing.lg },
  nickname: { fontSize: 24, fontWeight: '800', color: colors.primary },
  joined: { color: colors.textSoft, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', marginTop: spacing.lg, marginBottom: spacing.lg },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { color: colors.textSoft, fontSize: 12, marginTop: spacing.xs },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: spacing.sm, marginBottom: spacing.sm },
  badgeRow: { gap: spacing.sm, paddingBottom: spacing.md },
  badgeChip: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 76,
  },
  badgeChipLocked: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  badgeEmoji: { fontSize: 24 },
  badgeEmojiLocked: { opacity: 0.3 },
  badgeName: { fontSize: 11, color: colors.primary, marginTop: spacing.xs, textAlign: 'center' },
  badgeNameLocked: { color: colors.textSoft },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textSoft },
});
