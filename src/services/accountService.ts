import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

// 계정 삭제 시 사용자가 만든 모든 콘텐츠를 함께 지운다.
// Google Play의 데이터 삭제 정책상 계정 정보만 지우고 콘텐츠를 남겨두면 안 된다.
// Spark(무료) 요금제라 Cloud Functions를 쓸 수 없어 클라이언트에서 순차 삭제한다.
async function deleteQueryDocs(collectionName: string, field: string, value: string): Promise<number> {
  const snap = await getDocs(query(collection(db, collectionName), where(field, '==', value)));
  if (snap.empty) return 0;

  // Firestore 배치는 한 번에 500개까지 처리할 수 있다.
  const chunks: (typeof snap.docs)[] = [];
  for (let i = 0; i < snap.docs.length; i += 450) {
    chunks.push(snap.docs.slice(i, i + 450));
  }
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

export interface DeletionSummary {
  posts: number;
  writings: number;
  comments: number;
  likes: number;
}

// 사용자 콘텐츠를 모두 삭제한다. Auth 계정 삭제 직전에 호출해야 한다
// (계정이 먼저 사라지면 보안 규칙 때문에 콘텐츠를 지울 권한이 없어진다).
export async function deleteAllUserContent(uid: string, nickname?: string): Promise<DeletionSummary> {
  // 공개 게시물을 먼저 지워 다른 사용자 피드에서 즉시 사라지게 한다.
  const posts = await deleteQueryDocs('posts', 'userId', uid);
  const comments = await deleteQueryDocs('comments', 'userId', uid);
  const likes = await deleteQueryDocs('likes', 'userId', uid);
  const writings = await deleteQueryDocs('writings', 'userId', uid);

  // 닉네임 예약을 해제해 다른 사용자가 다시 쓸 수 있게 한다.
  if (nickname) {
    try {
      await deleteDoc(doc(db, 'nicknames', nickname.toLowerCase()));
    } catch {
      // 예약 문서가 없을 수도 있으므로 실패는 무시한다.
    }
  }

  await deleteDoc(doc(db, 'users', uid));

  return { posts, writings, comments, likes };
}
