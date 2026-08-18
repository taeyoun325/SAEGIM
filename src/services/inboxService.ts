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
import { getDisplayProfile } from './userService';

const notificationsCol = 'notifications';
const INBOX_LIMIT = 50;

// 좋아요/댓글/답글이 생기면 상대에게 인앱 알림을 남긴다. 자기 자신에게는 보내지 않는다
// (보안 규칙에서도 같은 조건을 강제하므로 이건 조기 차단용이다).
// 내가 차단한 사람의 활동은 피드/캘린더에서는 이미 숨기고 있었는데, 정작 그 사람이
// 내 글에 좋아요·댓글을 남기면 알림함에는 그대로 떴다 — 차단한 의미가 무색해진다.
// 그래서 알림을 만들기 전에 "받는 사람이 보내는 사람을 차단했는지"를 확인한다.
// (반대로 "보내는 사람이 받는 사람을 차단"한 경우는 다루지 않는다 — 그건 받는 사람
// 본인의 차단 목록에 없으므로 받는 사람 입장에서는 여전히 알림을 받고 싶을 수 있다.)
// 실패해도 원래 하려던 동작(좋아요/댓글 자체)을 막지 않도록 호출부에서 결과를 기다리지 않아도 된다.
export async function createNotification(
  recipientId: string,
  actorId: string,
  type: NotificationType,
  postId: string,
  commentId?: string | null
): Promise<void> {
  if (recipientId === actorId) return;
  const recipient = await getDisplayProfile(recipientId);
  if (recipient?.blockedUserIds?.includes(actorId)) return;
  // 신고 처리 결과(report_resolved/report_dismissed)는 설정 화면에서 끌 수 있는
  // 목록에 없으므로 이 배열엔 그 종류가 절대 들어있지 않다 — 운영 알림은 항상 온다.
  if (recipient?.mutedNotificationTypes?.includes(type)) return;
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
