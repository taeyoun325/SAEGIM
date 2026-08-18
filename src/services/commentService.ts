import {
  collection,
  deleteDoc,
  doc,
  DocumentSnapshot,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Comment } from '../types/models';
import { COMMENT_MAX_LENGTH, COMMENT_PAGE_SIZE } from '../constants/config';
import { adjustCommentCount, deleteDocsWhere } from './postService';
import { bumpDailyStats } from './statsService';
import { stampRateLimit, COOLDOWN_MESSAGE, isPermissionDenied } from './rateLimitService';
import { createNotification } from './inboxService';

const commentsCol = 'comments';

export function validateComment(content: string): { valid: boolean; reason?: string } {
  const trimmed = content.trim();
  if (trimmed.length === 0) return { valid: false, reason: '댓글을 입력해주세요.' };
  if (trimmed.length > COMMENT_MAX_LENGTH) return { valid: false, reason: `댓글은 ${COMMENT_MAX_LENGTH}자 이내로 작성해주세요.` };
  return { valid: true };
}

export interface AddCommentOptions {
  postOwnerId: string; // 알림 수신자를 정하려면 필요(호출부가 이미 post를 들고 있어 추가 조회 없이 넘겨준다)
  parentCommentId?: string | null; // 답글이면 원댓글 id
  parentAuthorId?: string | null; // 답글 대상 작성자(알림 수신자)
}

export async function addComment(
  postId: string,
  userId: string,
  authorNickname: string,
  content: string,
  opts: AddCommentOptions
): Promise<string> {
  const { valid, reason } = validateComment(content);
  if (!valid) throw new Error(reason);

  // 댓글 + 댓글 수 + 쿨다운 기록을 한 배치로 묶는다.
  // 도배 방지 규칙이 같은 커밋에서 쿨다운 문서가 갱신됐는지를 확인하므로 배치가 필수다.
  const commentRef = doc(collection(db, commentsCol));
  const batch = writeBatch(db);
  batch.set(commentRef, {
    postId,
    userId,
    authorNickname,
    content: content.trim(),
    createdAt: Date.now(),
    likeCount: 0,
    parentCommentId: opts.parentCommentId ?? null,
  } satisfies Omit<Comment, 'id'>);
  batch.update(doc(db, 'posts', postId), { commentCount: increment(1) });
  stampRateLimit(batch, userId, 'comment');

  try {
    await batch.commit();
  } catch (e) {
    if (isPermissionDenied(e)) throw new Error(COOLDOWN_MESSAGE.comment);
    throw e;
  }

  bumpDailyStats({ commentsCount: 1 }).catch(() => {});

  // 답글이면 원댓글 작성자에게, 아니면 글 작성자에게 알림을 보낸다(둘 다 자기 자신이면 자동으로 건너뜀).
  if (opts.parentCommentId && opts.parentAuthorId) {
    createNotification(opts.parentAuthorId, userId, 'comment_reply', postId, commentRef.id).catch(() => {});
  } else {
    createNotification(opts.postOwnerId, userId, 'post_comment', postId, commentRef.id).catch(() => {});
  }

  return commentRef.id;
}

// 댓글도 글처럼 오타나 생각이 바뀌었을 때 고칠 수 있어야 한다(지금까지는 삭제뿐이었다).
// 좋아요·작성일·글 id·답글 대상은 보안 규칙(ownerEditingCommentContent)이 그대로 강제한다.
export async function updateCommentContent(commentId: string, content: string): Promise<void> {
  const { valid, reason } = validateComment(content);
  if (!valid) throw new Error(reason);
  await updateDoc(doc(db, commentsCol, commentId), { content: content.trim(), editedAt: Date.now() });
}

export interface CommentPage {
  comments: Comment[];
  lastDoc: DocumentSnapshot | null;
}

export type CommentSort = 'oldest' | 'newest';

// 답글은 항상 원댓글 바로 아래 붙어야 하므로 정렬 기준과 무관하게 다루기 쉽도록
// 최상위 댓글만 정렬 순서를 바꾼다 — 화면(PostDetailScreen)의 orderedComments가
// parentCommentId로 답글을 묶어주는 로직과 맞물려 동작한다.
export async function getComments(
  postId: string,
  after?: DocumentSnapshot | null,
  sort: CommentSort = 'oldest'
): Promise<CommentPage> {
  const direction = sort === 'newest' ? 'desc' : 'asc';
  const q = after
    ? query(collection(db, commentsCol), where('postId', '==', postId), orderBy('createdAt', direction), startAfter(after), limit(COMMENT_PAGE_SIZE))
    : query(collection(db, commentsCol), where('postId', '==', postId), orderBy('createdAt', direction), limit(COMMENT_PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    comments: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
  };
}

// 댓글을 지우면 그 댓글에 달린 답글과 좋아요도 함께 정리한다
// (답글은 한 단계뿐이라 재귀 없이 한 번만 훑으면 된다).
export async function deleteComment(commentId: string, postId: string): Promise<void> {
  const repliesSnap = await getDocs(query(collection(db, commentsCol), where('parentCommentId', '==', commentId)));
  let removedCount = 1;
  for (const reply of repliesSnap.docs) {
    await deleteDocsWhere('commentLikes', 'commentId', reply.id);
    await deleteDoc(reply.ref);
    removedCount++;
  }
  await deleteDocsWhere('commentLikes', 'commentId', commentId);
  await deleteDoc(doc(db, commentsCol, commentId));
  for (let i = 0; i < removedCount; i++) {
    await adjustCommentCount(postId, -1);
  }
}
