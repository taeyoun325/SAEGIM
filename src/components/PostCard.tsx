import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable, Animated } from 'react-native';
import Text from './Text';
import { Post } from '../types/models';
import { colors, spacing, radius } from '../constants/theme';
import { getDisplayProfile } from '../services/userService';
import { toggleLike, hasLiked } from '../services/likeService';
import { useAuth } from '../context/AuthContext';
import { useShare } from '../context/ShareContext';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

interface Props {
  post: Post;
  onPress: () => void;
  onPressAuthor?: () => void;
  onPressComment?: () => void;
  // 목록 화면이 좋아요 여부를 미리 한 번에 조회해 넘겨주면 카드가 따로 조회하지 않는다.
  // 넘기지 않으면 카드가 알아서 조회하므로 기존 화면들은 그대로 동작한다.
  liked?: boolean;
}

const DOUBLE_TAP_MS = 300;

export default function PostCard({ post, onPress, onPressAuthor, onPressComment, liked: likedProp }: Props) {
  const { user } = useAuth();
  const { share } = useShare();
  const [nickname, setNickname] = useState<string>('...');
  const [liked, setLiked] = useState(likedProp ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const lastTapRef = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getDisplayProfile(post.userId).then((p) => setNickname(p?.nickname ?? '알 수 없음'));
  }, [post.userId]);

  useEffect(() => {
    if (likedProp !== undefined) {
      setLiked(likedProp);
      return;
    }
    if (!user) return;
    hasLiked(post.id, user.uid).then(setLiked);
  }, [post.id, user, likedProp]);

  function handleShare() {
    share({ lines: post.lines, createdAt: post.createdAt, filename: `saegim-${post.id}` });
  }

  async function like() {
    if (!user || liked) return;
    setLiked(true);
    setLikeCount((c) => c + 1);
    try {
      await toggleLike(post.id, user.uid);
    } catch {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    }
  }

  async function handleToggleLike() {
    if (!user) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => c + (nextLiked ? 1 : -1));
    try {
      await toggleLike(post.id, user.uid);
    } catch {
      setLiked(!nextLiked);
      setLikeCount((c) => c + (nextLiked ? -1 : 1));
    }
  }

  function playHeartAnim() {
    heartAnim.setValue(0);
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.timing(heartAnim, { toValue: 0, duration: 250, delay: 250, useNativeDriver: true }),
    ]).start();
  }

  function handleBodyPress() {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTapRef.current = 0;
      like();
      playHeartAnim();
      return;
    }
    lastTapRef.current = now;
    singleTapTimer.current = setTimeout(() => {
      onPress();
    }, DOUBLE_TAP_MS);
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.mainCol}>
          <TouchableOpacity onPress={onPressAuthor} disabled={!onPressAuthor}>
            <Text style={styles.nickname}>{nickname}</Text>
          </TouchableOpacity>
          <Pressable onPress={handleBodyPress}>
            {post.lines.map((line, i) => (
              <Text key={i} style={styles.line}>
                {line}
              </Text>
            ))}
            <Animated.Text
              style={[
                styles.bigHeart,
                {
                  opacity: heartAnim,
                  transform: [{ scale: heartAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }],
                },
              ]}
              pointerEvents="none"
            >
              ♥
            </Animated.Text>
          </Pressable>
        </View>
        <View style={styles.sideCol}>
          <Text style={styles.date}>{formatDisplayDate(timestampToDateString(post.createdAt))}</Text>
          <TouchableOpacity style={styles.sideButton} onPress={handleToggleLike}>
            <Text style={liked ? styles.likedIcon : styles.icon}>{liked ? '♥' : '♡'}</Text>
            <Text style={styles.sideCount}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideButton} onPress={onPressComment ?? onPress}>
            <Text style={styles.icon}>💬</Text>
            <Text style={styles.sideCount}>{post.commentCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideButton} onPress={handleShare}>
            <Text style={styles.icon}>📤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row' },
  mainCol: { flex: 1, paddingRight: spacing.sm },
  nickname: { fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  line: { color: colors.text, fontSize: 16, lineHeight: 24 },
  bigHeart: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
    fontSize: 64,
    color: colors.danger,
  },
  sideCol: { alignItems: 'center', width: 44, gap: spacing.sm },
  date: { color: colors.textSoft, fontSize: 11 },
  sideButton: { alignItems: 'center' },
  icon: { fontSize: 20, color: colors.textSoft },
  likedIcon: { fontSize: 20, color: colors.danger },
  sideCount: { color: colors.textSoft, fontSize: 11, marginTop: 2 },
});
