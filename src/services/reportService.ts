import { addDoc, collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Report, ReportReason, ReportTargetType } from '../types/models';
import { REPORT_MAX_PER_USER_PER_TARGET } from '../constants/config';

const reportsCol = 'reports';

export async function hasAlreadyReported(reporterId: string, targetId: string): Promise<boolean> {
  const q = query(
    collection(db, reportsCol),
    where('reporterId', '==', reporterId),
    where('targetId', '==', targetId),
    limit(REPORT_MAX_PER_USER_PER_TARGET)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function submitReport(
  targetType: ReportTargetType,
  targetId: string,
  reporterId: string,
  reason: ReportReason,
  detail?: string
): Promise<void> {
  const already = await hasAlreadyReported(reporterId, targetId);
  if (already) throw new Error('이미 신고한 콘텐츠예요.');
  await addDoc(collection(db, reportsCol), {
    targetType,
    targetId,
    reporterId,
    reason,
    detail: detail ?? '',
    createdAt: Date.now(),
    status: 'pending',
  } satisfies Omit<Report, 'id'>);
}
