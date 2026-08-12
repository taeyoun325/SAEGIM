import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentSnapshot,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Comment } from '../types/models';
import { COMMENT_MAX_LENGTH, COMMENT_PAGE_SIZE } from '../constants/config';
import { adjustCommentCount } from './postService';

const commentsCol = 'comments';

export function validateComment(content: string): { valid: boolean; reason?: string } {
  const trimmed = content.trim();
  if (trimmed.length === 0) return { valid: false, reason: '댓글을 입력해주세요.' };
  if (trimmed.length > COMMENT_MAX_LENGTH) return { valid: false, reason: `댓글은 ${COMMENT_MAX_LENGTH}자 이내로 작성해주세요.` };
  return { valid: true };
}

export async function addComment(postId: string, userId: string, authorNickname: string, content: string): Promise<string> {
  const { valid, reason } = validateComment(content);
  if (!valid) throw new Error(reason);
  const docRef = await addDoc(collection(db, commentsCol), {
    postId,
    userId,
    authorNickname,
    content: content.trim(),
    createdAt: Date.now(),
  } satisfies Omit<Comment, 'id'>);
  await adjustCommentCount(postId, 1);
  return docRef.id;
}

export interface CommentPage {
  comments: Comment[];
  lastDoc: DocumentSnapshot | null;
}

export async function getComments(postId: string, after?: DocumentSnapshot | null): Promise<CommentPage> {
  const q = after
    ? query(collection(db, commentsCol), where('postId', '==', postId), orderBy('createdAt', 'asc'), startAfter(after), limit(COMMENT_PAGE_SIZE))
    : query(collection(db, commentsCol), where('postId', '==', postId), orderBy('createdAt', 'asc'), limit(COMMENT_PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    comments: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
  };
}

export async function deleteComment(commentId: string, postId: string): Promise<void> {
  await deleteDoc(doc(db, commentsCol, commentId));
  await adjustCommentCount(postId, -1);
}
