import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';

const likesCol = 'likes';
const postsCol = 'posts';

function likeDocId(postId: string, userId: string): string {
  return `${postId}_${userId}`;
}

// like/unlike는 트랜잭션으로 처리해 동시 요청에도 likeCount가 정확히 유지된다.
export async function toggleLike(postId: string, userId: string): Promise<boolean> {
  const likeRef = doc(db, likesCol, likeDocId(postId, userId));
  const postRef = doc(db, postsCol, postId);

  return runTransaction(db, async (tx) => {
    const likeSnap = await tx.get(likeRef);
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists()) throw new Error('게시물을 찾을 수 없어요.');

    if (likeSnap.exists()) {
      tx.delete(likeRef);
      tx.update(postRef, { likeCount: Math.max(0, (postSnap.data().likeCount || 0) - 1) });
      return false;
    } else {
      tx.set(likeRef, { id: likeDocId(postId, userId), postId, userId, createdAt: Date.now() });
      tx.update(postRef, { likeCount: (postSnap.data().likeCount || 0) + 1 });
      return true;
    }
  });
}

export async function hasLiked(postId: string, userId: string): Promise<boolean> {
  const likeRef = doc(db, likesCol, likeDocId(postId, userId));
  const snap = await getDoc(likeRef);
  return snap.exists();
}
