import { collection, doc, documentId, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { bumpDailyStats } from './statsService';
import { createNotification } from './inboxService';

const likesCol = 'likes';
const postsCol = 'posts';

function likeDocId(postId: string, userId: string): string {
  return `${postId}_${userId}`;
}

// like/unlike는 트랜잭션으로 처리해 동시 요청에도 likeCount가 정확히 유지된다.
export async function toggleLike(postId: string, userId: string): Promise<boolean> {
  const likeRef = doc(db, likesCol, likeDocId(postId, userId));
  const postRef = doc(db, postsCol, postId);

  const { nowLiked, ownerId } = await runTransaction(db, async (tx) => {
    const likeSnap = await tx.get(likeRef);
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists()) throw new Error('게시물을 찾을 수 없어요.');
    const owner = postSnap.data().userId as string;

    if (likeSnap.exists()) {
      tx.delete(likeRef);
      tx.update(postRef, { likeCount: Math.max(0, (postSnap.data().likeCount || 0) - 1) });
      return { nowLiked: false, ownerId: owner };
    } else {
      tx.set(likeRef, { id: likeDocId(postId, userId), postId, userId, createdAt: Date.now() });
      tx.update(postRef, { likeCount: (postSnap.data().likeCount || 0) + 1 });
      return { nowLiked: true, ownerId: owner };
    }
  });

  if (nowLiked) {
    bumpDailyStats({ likesCount: 1 }).catch(() => {});
    // 좋아요를 취소할 때는 알림을 보내지 않는다(누른 순간에만 알림 가치가 있다).
    createNotification(ownerId, userId, 'post_like', postId).catch(() => {});
  }
  return nowLiked;
}

export async function hasLiked(postId: string, userId: string): Promise<boolean> {
  const likeRef = doc(db, likesCol, likeDocId(postId, userId));
  const snap = await getDoc(likeRef);
  return snap.exists();
}

// 목록 화면에서 카드마다 hasLiked를 따로 부르면 글 개수만큼 조회가 나간다.
// 좋아요 문서 id가 `${postId}_${uid}`로 정해져 있으므로 id 목록으로 한 번에 가져온다.
// documentId() in 조회는 한 번에 30개까지라 그 단위로 끊는다(피드 한 쪽은 10개).
const ID_QUERY_CHUNK = 30;

export async function getLikedPostIds(postIds: string[], userId: string): Promise<Set<string>> {
  const liked = new Set<string>();
  if (postIds.length === 0) return liked;

  const ids = postIds.map((postId) => likeDocId(postId, userId));
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_QUERY_CHUNK) chunks.push(ids.slice(i, i + ID_QUERY_CHUNK));

  const snaps = await Promise.all(
    chunks.map((chunk) => getDocs(query(collection(db, likesCol), where(documentId(), 'in', chunk))))
  );
  for (const snap of snaps) {
    snap.docs.forEach((d) => liked.add(d.data().postId as string));
  }
  return liked;
}
