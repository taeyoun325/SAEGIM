import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Text from './Text';
import { Post } from '../types/models';
import { colors, spacing, radius } from '../constants/theme';
import { getUserProfile } from '../services/userService';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

interface Props {
  post: Post;
  onPress: () => void;
  onPressAuthor?: () => void;
}

export default function PostCard({ post, onPress, onPressAuthor }: Props) {
  const [nickname, setNickname] = useState<string>('...');

  useEffect(() => {
    getUserProfile(post.userId).then((p) => setNickname(p?.nickname ?? '알 수 없음'));
  }, [post.userId]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onPressAuthor} disabled={!onPressAuthor}>
          <Text style={styles.nickname}>{nickname}</Text>
        </TouchableOpacity>
        <Text style={styles.date}>{formatDisplayDate(timestampToDateString(post.createdAt))}</Text>
      </View>
      {post.lines.map((line, i) => (
        <Text key={i} style={styles.line}>
          {line}
        </Text>
      ))}
      <View style={styles.footerRow}>
        <Text style={styles.stat}>♡ {post.likeCount}</Text>
        <Text style={styles.stat}>💬 {post.commentCount}</Text>
      </View>
    </TouchableOpacity>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  nickname: { fontWeight: '700', color: colors.primary },
  date: { color: colors.textSoft, fontSize: 12 },
  line: { color: colors.text, fontSize: 16, lineHeight: 24 },
  footerRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  stat: { color: colors.textSoft, fontSize: 13 },
});
