import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createNotification } from './inboxService';

const commentLikesCol = 'commentLikes';
const commentsCol = 'comments';

function likeDocId(commentId: string, userId: string): string {
  return `${commentId}_${userId}`;
}

// likeService.toggleLike와 동일한 트랜잭션 패턴. 댓글 문서에서 postId/작성자를 읽어와
// 알림 수신자를 정한다(호출부가 postId를 몰라도 되게 하려고 여기서 직접 읽는다).
export async function toggleCommentLike(commentId: string, userId: string): Promise<boolean> {
  const likeRef = doc(db, commentLikesCol, likeDocId(commentId, userId));
  const commentRef = doc(db, commentsCol, commentId);

  const { nowLiked, postId, authorId } = await runTransaction(db, async (tx) => {
    const likeSnap = await tx.get(likeRef);
    const commentSnap = await tx.get(commentRef);
    if (!commentSnap.exists()) throw new Error('댓글을 찾을 수 없어요.');
    const data = commentSnap.data();
    const pId = data.postId as string;
    const author = data.userId as string;

    if (likeSnap.exists()) {
      tx.delete(likeRef);
      tx.update(commentRef, { likeCount: Math.max(0, (data.likeCount || 0) - 1) });
      return { nowLiked: false, postId: pId, authorId: author };
    } else {
      tx.set(likeRef, { id: likeDocId(commentId, userId), commentId, postId: pId, userId, createdAt: Date.now() });
      tx.update(commentRef, { likeCount: (data.likeCount || 0) + 1 });
      return { nowLiked: true, postId: pId, authorId: author };
    }
  });

  if (nowLiked) {
    createNotification(authorId, userId, 'comment_like', postId, commentId).catch(() => {});
  }
  return nowLiked;
}

export async function hasLikedComment(commentId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, commentLikesCol, likeDocId(commentId, userId)));
  return snap.exists();
}
