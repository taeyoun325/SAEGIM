import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Comment, Post, Report } from '../types/models';

// 관리자 여부 확인. admins/{uid} 문서는 Admin SDK로만 생성되므로
// 사용자가 스스로 관리자가 될 수는 없다.
export async function isAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    // 권한이 없으면 규칙에서 거부되므로 관리자가 아니라고 판단한다.
    return false;
  }
}

export interface ReportWithTarget extends Report {
  // 신고 대상 콘텐츠. 이미 삭제됐으면 null.
  targetLines?: string[] | null;
  targetContent?: string | null;
  targetAuthorId?: string | null;
}

// 미처리 신고를 최신순으로 가져오고, 각 신고의 대상 콘텐츠를 함께 붙인다.
export async function getPendingReports(max = 50): Promise<ReportWithTarget[]> {
  const snap = await getDocs(
    query(collection(db, 'reports'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(max))
  );

  const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report));

  return Promise.all(
    reports.map(async (r) => {
      try {
        if (r.targetType === 'post') {
          const p = await getDoc(doc(db, 'posts', r.targetId));
          if (!p.exists()) return { ...r, targetLines: null, targetAuthorId: null };
          const post = p.data() as Post;
          return { ...r, targetLines: post.lines, targetAuthorId: post.userId };
        }
        const c = await getDoc(doc(db, 'comments', r.targetId));
        if (!c.exists()) return { ...r, targetContent: null, targetAuthorId: null };
        const comment = c.data() as Comment;
        return { ...r, targetContent: comment.content, targetAuthorId: comment.userId };
      } catch {
        return { ...r, targetLines: null, targetContent: null, targetAuthorId: null };
      }
    })
  );
}

// 신고된 콘텐츠를 삭제하고 신고를 처리 완료로 표시한다.
export async function deleteReportedContent(report: Report): Promise<void> {
  const col = report.targetType === 'post' ? 'posts' : 'comments';
  await deleteDoc(doc(db, col, report.targetId)).catch(() => {
    // 이미 삭제된 콘텐츠일 수 있다. 신고 처리는 계속 진행한다.
  });
  await updateDoc(doc(db, 'reports', report.id), { status: 'reviewed' });
}

// 문제가 없다고 판단한 신고를 기각한다.
export async function dismissReport(reportId: string): Promise<void> {
  await updateDoc(doc(db, 'reports', reportId), { status: 'dismissed' });
}
