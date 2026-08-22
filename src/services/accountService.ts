import { collection, deleteDoc, doc, getDocs, increment, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { deleteDocsWhere as deleteQueryDocs, deletePostRelatedContent } from './postService';
import { deleteProfileImage } from './storageService';

// 계정 삭제 시 사용자가 만든 모든 콘텐츠를 함께 지운다.
// Google Play의 데이터 삭제 정책상 계정 정보만 지우고 콘텐츠를 남겨두면 안 된다.
// Spark(무료) 요금제라 Cloud Functions를 쓸 수 없어 클라이언트에서 순차 삭제한다.

export interface DeletionSummary {
  posts: number;
  writings: number;
  comments: number;
  likes: number;
}

// 내가 남긴 좋아요/댓글을 지울 때는 상대방 게시물의 카운트도 함께 줄여야 한다.
// 문서만 지우면 "♥ 1인데 좋아요 0건"처럼 영영 틀린 숫자가 남는다.
//
// 카운트는 보안 규칙상 한 번에 ±1만 바꿀 수 있어서 문서 하나씩 처리한다.
// 특히 좋아요는 "좋아요 문서가 실제로 사라질 때만 -1"이 규칙이라
// 삭제와 감소가 반드시 같은 커밋이어야 한다.
// (좋아요/댓글이 아주 많은 계정은 그만큼 커밋이 늘어 삭제가 느려지지만,
//  숫자가 틀린 채 남는 것보다는 낫다.)
async function deleteMyReactions(
  collectionName: 'likes' | 'comments',
  counterField: 'likeCount' | 'commentCount',
  uid: string
): Promise<number> {
  const snap = await getDocs(query(collection(db, collectionName), where('userId', '==', uid)));
  for (const d of snap.docs) {
    const postId = d.data().postId as string;
    // 댓글에 달린 좋아요는 댓글이 사라지면 참조할 곳이 없어지므로 함께 정리한다.
    if (collectionName === 'comments') {
      await deleteQueryDocs('commentLikes', 'commentId', d.id);
    }
    const batch = writeBatch(db);
    batch.delete(d.ref);
    batch.update(doc(db, 'posts', postId), { [counterField]: increment(-1) });
    try {
      await batch.commit();
    } catch {
      // 게시물이 이미 지워졌다면 줄일 카운트도 없다. 내 문서만 지우고 넘어간다.
      await deleteDoc(d.ref).catch(() => {});
    }
  }
  return snap.size;
}

// 사용자 콘텐츠를 모두 삭제한다. Auth 계정 삭제 직전에 호출해야 한다
// (계정이 먼저 사라지면 보안 규칙 때문에 콘텐츠를 지울 권한이 없어진다).
export async function deleteAllUserContent(uid: string, nickname?: string): Promise<DeletionSummary> {
  // 내 게시물에 다른 사람이 남긴 댓글/좋아요/저장이 고아로 남지 않도록 먼저 정리한다.
  const myPostsSnap = await getDocs(query(collection(db, 'posts'), where('userId', '==', uid)));
  for (const p of myPostsSnap.docs) {
    await deletePostRelatedContent(p.id);
  }

  // 공개 게시물을 지워 다른 사용자 피드에서 즉시 사라지게 한다.
  const posts = await deleteQueryDocs('posts', 'userId', uid);
  // 내가 다른 사람 글에 남긴 댓글/좋아요도 지운다(그 글의 카운트까지 함께 정리).
  const comments = await deleteMyReactions('comments', 'commentCount', uid);
  const likes = await deleteMyReactions('likes', 'likeCount', uid);
  await deleteQueryDocs('saves', 'userId', uid);
  await deleteQueryDocs('commentLikes', 'userId', uid);
  const writings = await deleteQueryDocs('writings', 'userId', uid);

  // 알림함도 흔적이 남지 않게 정리한다(내가 받은 것 + 내가 남긴 것 모두).
  await deleteQueryDocs('notifications', 'recipientId', uid);
  await deleteQueryDocs('notifications', 'actorId', uid);

  // 닉네임 예약을 해제해 다른 사용자가 다시 쓸 수 있게 한다.
  if (nickname) {
    try {
      await deleteDoc(doc(db, 'nicknames', nickname.toLowerCase()));
    } catch {
      // 예약 문서가 없을 수도 있으므로 실패는 무시한다.
    }
  }

  await deleteDoc(doc(db, 'users', uid));
  await deleteProfileImage(uid);

  return { posts, writings, comments, likes };
}
