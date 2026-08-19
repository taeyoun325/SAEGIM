import { useCallback, useMemo, useState } from 'react';
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
import { getComments, addComment, deleteComment, updateCommentContent, CommentSort } from '../services/commentService';
import { toggleLike, hasLiked } from '../services/likeService';
import { toggleCommentLike, hasLikedComment } from '../services/commentLikeService';
import { toggleSave, hasSaved } from '../services/saveService';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { COMMENT_MAX_LENGTH } from '../constants/config';
import { getDisplayProfile } from '../services/userService';
import { logEvent } from '../services/statsService';
import { useShare } from '../context/ShareContext';
import { formatDisplayDate, timestampToDateString } from '../utils/date';
import { containsSensitiveWord } from '../utils/textFilter';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PostDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { postId } = route.params as { postId: string };
  const { user, profile } = useAuth();
  const { confirm, notify } = useDialog();
  const { share } = useShare();

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
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>('oldest');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const p = await getPostById(postId);
      setPost(p);
      if (p) {
        const author = await getDisplayProfile(p.userId);
        setAuthorNickname(author?.nickname ?? '알 수 없음');
        const [commentPage, likedResult, savedResult] = await Promise.all([
          getComments(postId, null, commentSort),
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
  }, [postId, user, commentSort]);

  async function loadMoreComments() {
    if (!post || !commentsLastDoc || loadingMoreComments || !user) return;
    setLoadingMoreComments(true);
    try {
      const page = await getComments(post.id, commentsLastDoc, commentSort);
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

  function changeCommentSort(next: CommentSort) {
    if (next === commentSort) return;
    setCommentSort(next);
    setLoading(true);
  }

  // 차단한 사람의 댓글은 피드/캘린더/알림함과 마찬가지로 여기서도 보이면 안 된다.
  // (지금까지 이 화면만 빠져 있었다 — 차단해도 그 사람 댓글은 계속 보였다.)
  const visibleComments = useMemo(() => {
    const blockedIds = profile?.blockedUserIds ?? [];
    if (blockedIds.length === 0) return comments;
    return comments.filter((c) => !blockedIds.includes(c.userId));
  }, [comments, profile?.blockedUserIds]);

  // 댓글 목록을 "최상위 댓글 → 그 밑에 딸린 답글" 순서로 다시 배열한다.
  // 답글은 한 단계뿐이고, 커서 페이지네이션 경계에 걸려 부모를 아직 못 불러온 답글은
  // 최상위처럼 보여준다(드문 경우라 단순하게 처리).
  const orderedComments = useMemo(() => {
    const topLevelIds = new Set(visibleComments.filter((c) => !c.parentCommentId).map((c) => c.id));
    const repliesByParent = new Map<string, Comment[]>();
    visibleComments.forEach((c) => {
      if (c.parentCommentId) {
        const list = repliesByParent.get(c.parentCommentId) ?? [];
        list.push(c);
        repliesByParent.set(c.parentCommentId, list);
      }
    });
    const ordered: { comment: Comment; isReply: boolean }[] = [];
    visibleComments
      .filter((c) => !c.parentCommentId)
      .forEach((c) => {
        ordered.push({ comment: c, isReply: false });
        (repliesByParent.get(c.id) ?? []).forEach((r) => ordered.push({ comment: r, isReply: true }));
      });
    visibleComments.forEach((c) => {
      if (c.parentCommentId && !topLevelIds.has(c.parentCommentId)) {
        ordered.push({ comment: c, isReply: false });
      }
    });
    return ordered;
  }, [visibleComments]);

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
    share({ lines: post.lines, createdAt: post.createdAt, filename: `saegim-${post.id}` });
  }

  async function handleAddComment() {
    if (!user || !post || !profile || !commentText.trim()) return;
    if (containsSensitiveWord(commentText)) {
      const ok = await confirm({
        title: '잠깐, 다시 한번 확인해보세요',
        message: '상대방이 상처받을 수 있는 표현이 있는 것 같아요. 그래도 남기시겠어요?',
        confirmLabel: '그대로 남기기',
        cancelLabel: '다시 쓰기',
      });
      if (!ok) return;
    }
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

  function startEditComment(comment: Comment) {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditCommentText('');
  }

  async function handleSaveEditComment(comment: Comment) {
    if (!editCommentText.trim()) return;
    if (containsSensitiveWord(editCommentText)) {
      const ok = await confirm({
        title: '잠깐, 다시 한번 확인해보세요',
        message: '상대방이 상처받을 수 있는 표현이 있는 것 같아요. 그래도 남기시겠어요?',
        confirmLabel: '그대로 남기기',
        cancelLabel: '다시 쓰기',
      });
      if (!ok) return;
    }
    setSavingEdit(true);
    try {
      await updateCommentContent(comment.id, editCommentText);
      const editedAt = Date.now();
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, content: editCommentText.trim(), editedAt } : c))
      );
      cancelEditComment();
    } catch (e: any) {
      await notify('오류', e?.message || '댓글 수정에 실패했어요.');
    } finally {
      setSavingEdit(false);
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
                <TouchableOpacity
                  onPress={handleToggleLike}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel={`좋아요 ${post.likeCount}개`}
                  aria-selected={liked}
                >
                  <Text style={liked ? styles.likedText : styles.actionText}>{liked ? '♥' : '♡'} {post.likeCount}</Text>
                </TouchableOpacity>
                <Text style={styles.actionText}>💬 {post.commentCount}</Text>
                <TouchableOpacity
                  onPress={handleToggleSave}
                  accessibilityRole="button"
                  accessibilityLabel={saved ? '저장 취소' : '저장하기'}
                  aria-selected={saved}
                >
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
            <View style={styles.commentsHeaderRow}>
              <Text style={styles.commentsTitle}>댓글 {visibleComments.length}</Text>
              <View style={styles.sortRow}>
                <TouchableOpacity onPress={() => changeCommentSort('oldest')}>
                  <Text style={[styles.sortText, commentSort === 'oldest' && styles.sortTextActive]}>오래된순</Text>
                </TouchableOpacity>
                <Text style={styles.sortDivider}>·</Text>
                <TouchableOpacity onPress={() => changeCommentSort('newest')}>
                  <Text style={[styles.sortText, commentSort === 'newest' && styles.sortTextActive]}>최신순</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
        renderItem={({ item: { comment, isReply } }) => {
          const commentLiked = likedCommentIds.has(comment.id);
          const isEditing = editingCommentId === comment.id;
          return (
            <View style={[styles.commentRow, isReply && styles.commentRowReply]}>
              <View style={{ flex: 1 }}>
                <View style={styles.commentAuthorRow}>
                  <Text style={styles.commentAuthor}>{comment.authorNickname}</Text>
                  <Text style={styles.commentTime}>
                    {formatDisplayDate(timestampToDateString(comment.createdAt))}
                    {comment.editedAt ? ' (수정됨)' : ''}
                  </Text>
                </View>
                {isEditing ? (
                  <>
                    <TextInput
                      style={styles.commentEditInput}
                      value={editCommentText}
                      onChangeText={setEditCommentText}
                      maxLength={COMMENT_MAX_LENGTH}
                      multiline
                    />
                    <Text style={styles.commentCounter}>{editCommentText.length}/{COMMENT_MAX_LENGTH}</Text>
                    <View style={styles.commentActionsRow}>
                      <TouchableOpacity onPress={cancelEditComment} disabled={savingEdit}>
                        <Text style={styles.commentActionText}>취소</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleSaveEditComment(comment)} disabled={savingEdit}>
                        <Text style={styles.commentSaveText}>{savingEdit ? '저장 중...' : '저장'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.commentContent}>{comment.content}</Text>
                    <View style={styles.commentActionsRow}>
                      <TouchableOpacity
                        onPress={() => handleToggleCommentLike(comment)}
                        style={styles.commentActionButton}
                        accessibilityRole="button"
                        accessibilityLabel={`댓글 좋아요 ${comment.likeCount ?? 0}개`}
                        aria-selected={commentLiked}
                      >
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
                  </>
                )}
              </View>
              {!isEditing && (
                comment.userId === user?.uid ? (
                  <View style={styles.ownCommentActions}>
                    <TouchableOpacity onPress={() => startEditComment(comment)}>
                      <Text style={styles.deleteText}>수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteComment(comment)}>
                      <Text style={styles.deleteText}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => navigation.navigate('Report', { targetType: 'comment', targetId: comment.id })}>
                    <Text style={styles.deleteText}>신고</Text>
                  </TouchableOpacity>
                )
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
      <View style={styles.commentInputWrap}>
        <Text style={styles.commentCounter}>{commentText.length}/{COMMENT_MAX_LENGTH}</Text>
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
      </View>
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
  commentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  commentsTitle: { fontWeight: '700', color: colors.primary },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sortText: { color: colors.textSoft, fontSize: 12 },
  sortTextActive: { color: colors.primary, fontWeight: '700' },
  sortDivider: { color: colors.border, fontSize: 12 },
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
  ownCommentActions: { flexDirection: 'row', gap: spacing.sm },
  commentEditInput: {
    marginTop: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    fontSize: 14,
  },
  commentSaveText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  commentCounter: { color: colors.textSoft, fontSize: 12, textAlign: 'right', marginTop: spacing.xs },
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
  commentInputWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  commentInput: { flex: 1, backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text },
  sendText: { color: colors.primary, fontWeight: '700' },
});
