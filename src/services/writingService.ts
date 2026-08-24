import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Writing } from '../types/models';
import { WRITING_TOTAL_MAX_LENGTH, WRITING_MIN_LINES_REQUIRED, WRITING_MAX_LINES } from '../constants/config';
import { stampRateLimit, COOLDOWN_MESSAGE, isPermissionDenied } from './rateLimitService';

const writingsCol = 'writings';

// 비공개 글을 실수로 지웠을 때 되돌릴 수 있는 기간. 공개 글은 대상이 아니다
// (이미 다른 사람 피드에 노출된 콘텐츠라 삭제 자체가 더 신중한 행동이고,
// 피드/좋아요/댓글까지 얽혀 있어 소프트 삭제로 다루면 범위가 커진다).
export const TRASH_GRACE_DAYS = 30;

export function validateLines(lines: string[]): { valid: boolean; reason?: string } {
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length < WRITING_MIN_LINES_REQUIRED) {
    return { valid: false, reason: '내용을 새겨주세요.' };
  }
  // 보안 규칙(firestore.rules의 validLines)이 줄 수를 10으로 막는다. 여기서 먼저 걸러야
  // 사용자가 권한 오류를 받고 "도배 방지" 메시지를 잘못 보게 되는 일이 없다.
  if (nonEmpty.length > WRITING_MAX_LINES) {
    return { valid: false, reason: `줄 수는 ${WRITING_MAX_LINES}줄 이내로 새겨주세요.` };
  }
  if (lines.join('\n').length > WRITING_TOTAL_MAX_LENGTH) {
    return { valid: false, reason: `${WRITING_TOTAL_MAX_LENGTH}자 이내로 새겨주세요.` };
  }
  return { valid: true };
}

export async function createWriting(
  userId: string,
  promptId: string,
  lines: string[],
  visibility: 'private' | 'public',
  category?: string,
  mood?: string | null
): Promise<string> {
  const { valid, reason } = validateLines(lines);
  if (!valid) throw new Error(reason);
  const now = Date.now();

  // 쿨다운 기록을 같은 배치에 넣어야 도배 방지 규칙을 통과한다(rateLimitService 주석 참고).
  const writingRef = doc(collection(db, writingsCol));
  const batch = writeBatch(db);
  batch.set(writingRef, {
    userId,
    promptId,
    lines: lines.filter((l) => l.trim().length > 0),
    createdAt: now,
    updatedAt: now,
    visibility,
    postId: null,
    ...(category ? { category } : {}),
    ...(mood ? { mood } : {}),
  } satisfies Omit<Writing, 'id'>);
  stampRateLimit(batch, userId, 'writing');

  try {
    await batch.commit();
  } catch (e) {
    if (isPermissionDenied(e)) throw new Error(COOLDOWN_MESSAGE.writing);
    throw e;
  }
  return writingRef.id;
}

export async function getWritingById(id: string): Promise<Writing | null> {
  const snap = await getDoc(doc(db, writingsCol, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Writing) : null;
}

export async function getMyWritingForPrompt(userId: string, promptId: string): Promise<Writing | null> {
  const q = query(collection(db, writingsCol), where('userId', '==', userId), where('promptId', '==', promptId));
  const snap = await getDocs(q);
  // 오늘 글을 지웠다가(휴지통행) 같은 날 다시 쓸 수도 있으므로, 휴지통에 있는
  // 문서는 "이미 썼음" 판정에서 제외한다 — 안 그러면 지운 뒤 다시 쓰지 못하게 막힌다.
  const active = snap.docs.find((d) => !d.data().deletedAt);
  if (!active) return null;
  return { id: active.id, ...active.data() } as Writing;
}

export async function getMyWritings(userId: string): Promise<Writing[]> {
  const q = query(collection(db, writingsCol), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  // 휴지통에 있는 글(deletedAt 있음)은 "내 새김 관리" 목록에서는 빠져야 한다.
  // deletedAt 조건까지 넣는 복합 인덱스를 새로 만들 필요 없이, 어차피 사용자
  // 1인의 글 수는 적어 클라이언트에서 거른다.
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Writing)).filter((w) => !w.deletedAt);
}

// 소프트 삭제: 실제로 지우지 않고 시각만 남긴다. 비공개 글에만 쓴다(postId가 없는 글).
export async function softDeleteWriting(writingId: string): Promise<void> {
  await updateDoc(doc(db, writingsCol, writingId), { deletedAt: Date.now() });
}

export async function restoreWriting(writingId: string): Promise<void> {
  await updateDoc(doc(db, writingsCol, writingId), { deletedAt: null });
}

export async function getTrashedWritings(userId: string): Promise<Writing[]> {
  const q = query(collection(db, writingsCol), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Writing)).filter((w) => !!w.deletedAt);
}

// 휴지통 화면을 열 때마다 불러서, 보관 기한이 지난 글을 그제서야 실제로 지운다
// (Cloud Functions 없이 서버가 알아서 정리해줄 방법이 없어, 사용자가 휴지통을
// 볼 때 기회 삼아 정리하는 방식을 택했다 — 안 열어도 결국 다음에 열 때 정리된다).
export async function purgeExpiredTrash(userId: string): Promise<void> {
  const trashed = await getTrashedWritings(userId);
  const cutoff = Date.now() - TRASH_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const expired = trashed.filter((w) => (w.deletedAt ?? 0) < cutoff);
  await Promise.all(expired.map((w) => deleteDoc(doc(db, writingsCol, w.id))));
}

export async function updateWritingVisibility(writingId: string, visibility: 'private' | 'public'): Promise<void> {
  await updateDoc(doc(db, writingsCol, writingId), { visibility, updatedAt: Date.now() });
}

export async function updateWritingContent(writingId: string, lines: string[]): Promise<void> {
  const { valid, reason } = validateLines(lines);
  if (!valid) throw new Error(reason);
  await updateDoc(doc(db, writingsCol, writingId), {
    lines: lines.filter((l) => l.trim().length > 0),
    updatedAt: Date.now(),
  });
}

export async function linkWritingToPost(writingId: string, postId: string | null): Promise<void> {
  await updateDoc(doc(db, writingsCol, writingId), { postId });
}

// 게시물이 사라졌을 때 원본 글을 비공개로 되돌리며 연결도 함께 끊는다.
// 반드시 한 번의 쓰기로 처리해야 한다 — 보안 규칙의 adminResettingWritingVisibility가
// "visibility가 private이면서 postId가 null"인 요청만 허용하므로, 두 번에 나눠 쓰면
// 관리자가 신고된 글을 지울 때 첫 쓰기에서 거부된다.
export async function unlinkWritingFromPost(writingId: string): Promise<void> {
  await updateDoc(doc(db, writingsCol, writingId), { visibility: 'private', postId: null });
}

export async function updateWritingMood(writingId: string, mood: string | null): Promise<void> {
  await updateDoc(doc(db, writingsCol, writingId), { mood });
}

export async function toggleWritingFavorite(writingId: string, next: boolean): Promise<void> {
  await updateDoc(doc(db, writingsCol, writingId), { favorited: next });
}

