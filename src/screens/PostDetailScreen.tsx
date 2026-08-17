import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { toggleCommentLike, hasLikedComment } from '../services/commentLikeService';
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
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorId: string; nickname: string } | null>(null);
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
        const likedIds = await Promise.all(
          commentPage.comments.map((c) => hasLikedComment(c.id, user.uid).then((v) => (v ? c.id : null)))
        );
        setLikedCommentIds(new Set(likedIds.filter((id): id is string => id !== null)));
      }
    } finally {
      setLoading(false);
    }
  }, [postId, user]);

  async function loadMoreComments() {
    if (!post || !commentsLastDoc || loadingMoreComments || !user) return;
    setLoadingMoreComments(true);
    try {
      const page = await getComments(post.id, commentsLastDoc);
      setComments((prev) => [...prev, ...page.comments]);
      setCommentsLastDoc(page.lastDoc);
      const likedIds = await Promise.all(
        page.comments.map((c) => hasLikedComment(c.id, user.uid).then((v) => (v ? c.id : null)))
      );
      setLikedCommentIds((prev) => new Set([...prev, ...likedIds.filter((id): id is string => id !== null)]));
    } finally {
      setLoadingMoreComments(false);
    }
  }

  // 댓글 목록을 "최상위 댓글 → 그 밑에 딸린 답글" 순서로 다시 배열한다.
  // 답글은 한 단계뿐이고, 커서 페이지네이션 경계에 걸려 부모를 아직 못 불러온 답글은
  // 최상위처럼 보여준다(드문 경우라 단순하게 처리).
  const orderedComments = useMemo(() => {
    const topLevelIds = new Set(comments.filter((c) => !c.parentCommentId).map((c) => c.id));
    const repliesByParent = new Map<string, Comment[]>();
    comments.forEach((c) => {
      if (c.parentCommentId) {
        const list = repliesByParent.get(c.parentCommentId) ?? [];
        list.push(c);
        repliesByParent.set(c.parentCommentId, list);
      }
    });
    const ordered: { comment: Comment; isReply: boolean }[] = [];
    comments
      .filter((c) => !c.parentCommentId)
      .forEach((c) => {
        ordered.push({ comment: c, isReply: false });
        (repliesByParent.get(c.id) ?? []).forEach((r) => ordered.push({ comment: r, isReply: true }));
      });
    comments.forEach((c) => {
      if (c.parentCommentId && !topLevelIds.has(c.parentCommentId)) {
        ordered.push({ comment: c, isReply: false });
      }
    });
    return ordered;
  }, [comments]);

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
      await addComment(post.id, user.uid, profile.nickname, commentText, {
        postOwnerId: post.userId,
        parentCommentId: replyingTo?.commentId ?? null,
        parentAuthorId: replyingTo?.authorId ?? null,
      });
      setCommentText('');
      setReplyingTo(null);
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

  async function handleToggleCommentLike(comment: Comment) {
    if (!user) return;
    const wasLiked = likedCommentIds.has(comment.id);
    setLikedCommentIds((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(comment.id) : next.add(comment.id);
      return next;
    });
    setComments((prev) =>
      prev.map((c) => (c.id === comment.id ? { ...c, likeCount: (c.likeCount ?? 0) + (wasLiked ? -1 : 1) } : c))
    );
    try {
      await toggleCommentLike(comment.id, user.uid);
    } catch (e) {
      // 실패 시 낙관적 업데이트를 되돌린다.
      setLikedCommentIds((prev) => {
        const next = new Set(prev);
        wasLiked ? next.add(comment.id) : next.delete(comment.id);
        return next;
      });
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, likeCount: (c.likeCount ?? 0) + (wasLiked ? 1 : -1) } : c))
      );
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
        data={orderedComments}
        keyExtractor={(item) => item.comment.id}
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
        renderItem={({ item: { comment, isReply } }) => {
          const commentLiked = likedCommentIds.has(comment.id);
          return (
            <View style={[styles.commentRow, isReply && styles.commentRowReply]}>
              <View style={{ flex: 1 }}>
                <View style={styles.commentAuthorRow}>
                  <Text style={styles.commentAuthor}>{comment.authorNickname}</Text>
                  <Text style={styles.commentTime}>{formatDisplayDate(timestampToDateString(comment.createdAt))}</Text>
                </View>
                <Text style={styles.commentContent}>{comment.content}</Text>
                <View style={styles.commentActionsRow}>
                  <TouchableOpacity onPress={() => handleToggleCommentLike(comment)} style={styles.commentActionButton}>
                    <Text style={commentLiked ? styles.commentLikedText : styles.commentActionText}>
                      {commentLiked ? '♥' : '♡'} {comment.likeCount ?? 0}
                    </Text>
                  </TouchableOpacity>
                  {!isReply && (
                    <TouchableOpacity
                      onPress={() => setReplyingTo({ commentId: comment.id, authorId: comment.userId, nickname: comment.authorNickname })}
                    >
                      <Text style={styles.commentActionText}>답글</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              {comment.userId === user?.uid ? (
                <TouchableOpacity onPress={() => handleDeleteComment(comment)}>
                  <Text style={styles.deleteText}>삭제</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => navigation.navigate('Report', { targetType: 'comment', targetId: comment.id })}>
                  <Text style={styles.deleteText}>신고</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
      {replyingTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>{replyingTo.nickname}님에게 답글 남기는 중</Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Text style={styles.replyBannerCancel}>취소</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder={replyingTo ? '답글을 입력하세요' : '댓글을 입력하세요'}
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
  commentRowReply: { marginLeft: spacing.xl, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border },
  commentAuthorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor: { fontWeight: '600', color: colors.text, fontSize: 13 },
  commentTime: { color: colors.textSoft, fontSize: 11 },
  commentContent: { color: colors.text, marginTop: 2 },
  commentActionsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  commentActionButton: {},
  commentActionText: { color: colors.textSoft, fontSize: 12 },
  commentLikedText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  deleteText: { color: colors.textSoft, fontSize: 12 },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accentSoft,
  },
  replyBannerText: { color: colors.primary, fontSize: 12 },
  replyBannerCancel: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
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
