import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DocumentSnapshot } from 'firebase/firestore';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, radius } from '../constants/theme';
import { Post, Comment } from '../types/models';
import { getPostById, deletePost } from '../services/postService';
import { getComments, addComment, deleteComment } from '../services/commentService';
import { toggleLike, hasLiked } from '../services/likeService';
import { toggleSave, hasSaved } from '../services/saveService';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { COMMENT_MAX_LENGTH } from '../constants/config';
import { getUserProfile } from '../services/userService';
import { shareAsImage } from '../services/shareService';
import { logEvent } from '../services/statsService';
import ShareCard from '../components/ShareCard';
import ShareThemeModal from '../components/ShareThemeModal';
import { ShareTheme, DEFAULT_SHARE_THEME } from '../constants/shareThemes';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PostDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { postId } = route.params as { postId: string };
  const { user, profile } = useAuth();
  const { confirm, notify } = useDialog();

  const [post, setPost] = useState<Post | null>(null);
  const [authorNickname, setAuthorNickname] = useState('...');
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLastDoc, setCommentsLastDoc] = useState<DocumentSnapshot | null>(null);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [shareTheme, setShareTheme] = useState<ShareTheme>(DEFAULT_SHARE_THEME);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [pendingShare, setPendingShare] = useState(false);
  const shareCardRef = useRef<View>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const p = await getPostById(postId);
      setPost(p);
      if (p) {
        const author = await getUserProfile(p.userId);
        setAuthorNickname(author?.nickname ?? '알 수 없음');
        const [commentPage, likedResult, savedResult] = await Promise.all([
          getComments(postId),
          hasLiked(postId, user.uid),
          hasSaved(postId, user.uid),
        ]);
        setComments(commentPage.comments);
        setCommentsLastDoc(commentPage.lastDoc);
        setLiked(likedResult);
        setSaved(savedResult);
      }
    } finally {
      setLoading(false);
    }
  }, [postId, user]);

  async function loadMoreComments() {
    if (!post || !commentsLastDoc || loadingMoreComments) return;
    setLoadingMoreComments(true);
    try {
      const page = await getComments(post.id, commentsLastDoc);
      setComments((prev) => [...prev, ...page.comments]);
      setCommentsLastDoc(page.lastDoc);
    } finally {
      setLoadingMoreComments(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleLike() {
    if (!user || !post) return;
    try {
      const nowLiked = await toggleLike(post.id, user.uid);
      setLiked(nowLiked);
      setPost({ ...post, likeCount: post.likeCount + (nowLiked ? 1 : -1) });
    } catch (e) {
      await notify('오류', '좋아요 처리에 실패했어요.');
    }
  }

  async function handleToggleSave() {
    if (!user || !post) return;
    try {
      const nowSaved = await toggleSave(post.id, user.uid);
      setSaved(nowSaved);
      if (nowSaved) logEvent('post_save').catch(() => {});
    } catch (e) {
      await notify('오류', '저장 처리에 실패했어요.');
    }
  }

  function handleShare() {
    if (!post) return;
    logEvent('share_open').catch(() => {});
    setThemeModalVisible(true);
  }

  function handleThemeSelect(theme: ShareTheme) {
    setShareTheme(theme);
    setThemeModalVisible(false);
    setPendingShare(true);
  }

  useEffect(() => {
    if (!pendingShare || !post) return;
    setPendingShare(false);
    shareAsImage(shareCardRef, `saegim-${post.id}`)
      .then(() => logEvent('share_done').catch(() => {}))
      .catch(async () => {
        await notify('오류', '공유 이미지를 만들지 못했어요.');
      });
  }, [pendingShare, post, notify]);

  async function handleAddComment() {
    if (!user || !post || !profile || !commentText.trim()) return;
    setPosting(true);
    try {
      await addComment(post.id, user.uid, profile.nickname, commentText);
      setCommentText('');
      const page = await getComments(post.id);
      setComments(page.comments);
      setCommentsLastDoc(page.lastDoc);
      setPost({ ...post, commentCount: post.commentCount + 1 });
    } catch (e: any) {
      await notify('오류', e?.message || '댓글 작성에 실패했어요.');
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteComment(comment: Comment) {
    if (!post) return;
    const ok = await confirm({ title: '댓글을 삭제할까요?', confirmLabel: '삭제', destructive: true });
    if (!ok) return;
    try {
      await deleteComment(comment.id, post.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      setPost({ ...post, commentCount: Math.max(0, post.commentCount - 1) });
    } catch (e) {
      await notify('오류', '댓글을 삭제하지 못했어요.');
    }
  }

  async function handleDeletePost() {
    if (!post) return;
    const ok = await confirm({
      title: '게시물을 삭제할까요?',
      message: '삭제하면 다른 사람의 피드에서도 사라져요.',
      confirmLabel: '삭제',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePost(post.id, post.writingId);
      navigation.goBack();
    } catch (e) {
      await notify('오류', '게시물을 삭제하지 못했어요.');
    }
  }

  if (loading || !post) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isOwner = user?.uid === post.userId;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={loadMoreComments}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMoreComments ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} /> : null}
        ListHeaderComponent={
          <View>
            <View style={styles.postCard}>
              <Text style={styles.nickname}>{authorNickname}</Text>
              {post.lines.map((line, i) => (
                <Text key={i} style={styles.line}>
                  {line}
                </Text>
              ))}
              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={handleToggleLike} style={styles.actionButton}>
                  <Text style={liked ? styles.likedText : styles.actionText}>{liked ? '♥' : '♡'} {post.likeCount}</Text>
                </TouchableOpacity>
                <Text style={styles.actionText}>💬 {post.commentCount}</Text>
                <TouchableOpacity onPress={handleToggleSave}>
                  <Text style={saved ? styles.savedText : styles.actionText}>{saved ? '🔖' : '📑'} 저장</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare}>
                  <Text style={styles.actionText}>📤 공유</Text>
                </TouchableOpacity>
                {!isOwner && (
                  <TouchableOpacity onPress={() => navigation.navigate('Report', { targetType: 'post', targetId: post.id })}>
                    <Text style={styles.reportText}>신고</Text>
                  </TouchableOpacity>
                )}
                {isOwner && (
                  <TouchableOpacity onPress={handleDeletePost}>
                    <Text style={styles.reportText}>삭제</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Text style={styles.commentsTitle}>댓글 {comments.length}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.commentRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.commentAuthorRow}>
                <Text style={styles.commentAuthor}>{item.authorNickname}</Text>
                <Text style={styles.commentTime}>{formatDisplayDate(timestampToDateString(item.createdAt))}</Text>
              </View>
              <Text style={styles.commentContent}>{item.content}</Text>
            </View>
            {item.userId === user?.uid ? (
              <TouchableOpacity onPress={() => handleDeleteComment(item)}>
                <Text style={styles.deleteText}>삭제</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => navigation.navigate('Report', { targetType: 'comment', targetId: item.id })}>
                <Text style={styles.deleteText}>신고</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="댓글을 입력하세요"
          placeholderTextColor={colors.textSoft}
          value={commentText}
          onChangeText={setCommentText}
          maxLength={COMMENT_MAX_LENGTH}
        />
        <TouchableOpacity onPress={handleAddComment} disabled={posting}>
          <Text style={styles.sendText}>등록</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={shareCardRef} lines={post.lines} createdAt={post.createdAt} theme={shareTheme} />
      </View>
      <ShareThemeModal
        visible={themeModalVisible}
        onSelect={handleThemeSelect}
        onClose={() => setThemeModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  offscreen: { position: 'absolute', top: 0, left: -9999 },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  postCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  nickname: { fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  line: { fontSize: 16, lineHeight: 24, color: colors.text },
  actionsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, alignItems: 'center' },
  actionButton: {},
  actionText: { color: colors.textSoft },
  likedText: { color: colors.danger, fontWeight: '700' },
  savedText: { color: colors.primary, fontWeight: '700' },
  reportText: { color: colors.textSoft, marginLeft: 'auto' },
  commentsTitle: { marginTop: spacing.lg, marginBottom: spacing.sm, fontWeight: '700', color: colors.primary },
  commentRow: { flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  commentAuthorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor: { fontWeight: '600', color: colors.text, fontSize: 13 },
  commentTime: { color: colors.textSoft, fontSize: 11 },
  commentContent: { color: colors.text, marginTop: 2 },
  deleteText: { color: colors.textSoft, fontSize: 12 },
  commentInputRow: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    gap: spacing.sm,
  },
  commentInput: { flex: 1, backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text },
  sendText: { color: colors.primary, fontWeight: '700' },
});
