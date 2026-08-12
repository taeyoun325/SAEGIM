import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../constants/theme';
import { Post, UserProfile } from '../types/models';
import { getUserPublicPosts } from '../services/postService';
import { getUserProfile, blockUser } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import PostCard from '../components/PostCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OtherProfileScreen() {
  const route = useRoute();
  const navigation = useNavigation<Nav>();
  const { userId } = route.params as { userId: string };
  const { user, refreshProfile } = useAuth();
  const { confirm, notify } = useDialog();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
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
          <Text style={styles.nickname}>{profile.nickname}</Text>
          <TouchableOpacity onPress={handleBlock}>
            <Text style={styles.blockText}>차단하기</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>공개한 글</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>공개한 글이 없어요.</Text>
        </View>
      }
      renderItem={({ item }) => <PostCard post={item} onPress={() => navigation.navigate('PostDetail', { postId: item.id })} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { paddingTop: spacing.lg },
  nickname: { fontSize: 22, fontWeight: '800', color: colors.primary },
  blockText: { color: colors.danger, marginTop: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textSoft },
});
