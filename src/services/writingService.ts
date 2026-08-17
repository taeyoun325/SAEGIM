import {
  collection,
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
import { WRITING_TOTAL_MAX_LENGTH, WRITING_MIN_LINES_REQUIRED } from '../constants/config';
import { stampRateLimit, COOLDOWN_MESSAGE, isPermissionDenied } from './rateLimitService';

const writingsCol = 'writings';

export function validateLines(lines: string[]): { valid: boolean; reason?: string } {
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length < WRITING_MIN_LINES_REQUIRED) {
    return { valid: false, reason: '내용을 새겨주세요.' };
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
  category?: string
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
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Writing;
}

export async function getMyWritings(userId: string): Promise<Writing[]> {
  const q = query(collection(db, writingsCol), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Writing));
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

