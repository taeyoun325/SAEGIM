import { addDoc, collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
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

// 신고자 본인이 자기가 낸 신고들의 처리 상태를 볼 수 있게 한다("내 신고 내역" 화면용).
// 결과 알림(report_resolved/report_dismissed)은 그 순간 한 번 오고 사라지지만,
// 여기서는 대기 중인 신고까지 포함해 언제든 다시 확인할 수 있다.
export async function getMyReports(reporterId: string): Promise<Report[]> {
  const q = query(collection(db, reportsCol), where('reporterId', '==', reporterId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report));
}
