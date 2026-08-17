import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppNotification, NotificationType } from '../types/models';

const notificationsCol = 'notifications';
const INBOX_LIMIT = 50;

// 좋아요/댓글/답글이 생기면 상대에게 인앱 알림을 남긴다. 자기 자신에게는 보내지 않는다
// (보안 규칙에서도 같은 조건을 강제하므로 이건 조기 차단용이다).
// 실패해도 원래 하려던 동작(좋아요/댓글 자체)을 막지 않도록 호출부에서 결과를 기다리지 않아도 된다.
export async function createNotification(
  recipientId: string,
  actorId: string,
  type: NotificationType,
  postId: string,
  commentId?: string | null
): Promise<void> {
  if (recipientId === actorId) return;
  const ref = doc(collection(db, notificationsCol));
  const data: Omit<AppNotification, 'id'> = {
    recipientId,
    actorId,
    type,
    postId,
    commentId: commentId ?? null,
    createdAt: Date.now(),
    read: false,
  };
  await setDoc(ref, data);
}

export async function getNotifications(uid: string): Promise<AppNotification[]> {
  const q = query(
    collection(db, notificationsCol),
    where('recipientId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(INBOX_LIMIT)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
}

// 읽지 않은 알림 개수만 빠르게 센다. 4개 탭 화면이 각자 종 아이콘을 그리므로
// 전체 문서를 매번 내려받지 않고 집계 쿼리(1 read)로 처리한다.
export async function getUnreadCount(uid: string): Promise<number> {
  const q = query(collection(db, notificationsCol), where('recipientId', '==', uid), where('read', '==', false));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

// 알림함을 열 때 한 번에 모두 읽음 처리한다(받은메일함 패턴).
export async function markAllRead(notifications: AppNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, notificationsCol, n.id), { read: true }));
  await batch.commit();
}
