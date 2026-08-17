import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing } from '../constants/theme';
import { Post } from '../types/models';
import { getSavedPosts } from '../services/saveService';
import PostCard from '../components/PostCard';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SavedPostsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

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
      data={posts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>저장한 글이 없어요.{'\n'}마음에 드는 글을 저장해보세요.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <PostCard
          post={item}
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
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSoft, textAlign: 'center', lineHeight: 22 },
});
