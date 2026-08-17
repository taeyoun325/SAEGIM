import {
  collection,
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
import { Comment, DailyStats, Post, Report, UserProfile } from '../types/models';
import { todayDateString, timestampToDateString } from '../utils/date';
import { deletePost, getPostById } from './postService';
import { deleteComment } from './commentService';

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

const dailyStatsCol = 'dailyStats';

function emptyStats(date: string): DailyStats {
  return { date, newSignups: 0, writingsCount: 0, activeUserIds: [], commentsCount: 0, likesCount: 0 };
}

async function getDailyStats(date: string): Promise<DailyStats | null> {
  const snap = await getDoc(doc(db, dailyStatsCol, date));
  return snap.exists() ? (snap.data() as DailyStats) : null;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 오늘 하루치 운영 지표. dailyStats/{오늘} 문서 하나만 읽으므로 원문 콘텐츠에는 접근하지 않는다.
export async function getTodayStats(): Promise<DailyStats> {
  const date = todayDateString();
  return (await getDailyStats(date)) ?? emptyStats(date);
}

export interface ActiveUserMetrics {
  dau: number;
  wau: number;
  mau: number;
}

// DAU/WAU/MAU. dailyStats의 activeUserIds를 기간별로 합집합해 중복 없이 센다.
// ⚠️ activeUserIds는 recordTodayWriting에서만 채워지므로 "글을 쓴 사용자" 기준이다.
// (앱을 열기만 한 사용자는 집계되지 않는다 — 그건 분석 이벤트 수집이 있어야 한다.)
// 최근 30일 문서를 날짜 범위 쿼리 한 번으로 가져온다(최대 30 read).
export async function getActiveUserMetrics(): Promise<ActiveUserMetrics> {
  const today = todayDateString();
  const monthFrom = addDays(today, -29); // 오늘 포함 30일
  const weekFrom = addDays(today, -6); // 오늘 포함 7일

  const snap = await getDocs(
    query(collection(db, dailyStatsCol), where('date', '>=', monthFrom), where('date', '<=', today))
  );

  const dau = new Set<string>();
  const wau = new Set<string>();
  const mau = new Set<string>();

  snap.docs.forEach((d) => {
    const stats = d.data() as DailyStats;
    const ids = stats.activeUserIds ?? [];
    ids.forEach((id) => mau.add(id));
    if (stats.date >= weekFrom) ids.forEach((id) => wau.add(id));
    if (stats.date === today) ids.forEach((id) => dau.add(id));
  });

  return { dau: dau.size, wau: wau.size, mau: mau.size };
}

// 가입 → 첫 글 작성 전환율. writingCount가 프로필에 이미 있어 추가 조회 없이 계산된다.
export async function getFirstWriteConversion(
  sampleLimit = 300
): Promise<{ total: number; wrote: number; rate: number }> {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(sampleLimit)));
  const users = snap.docs.map((d) => d.data() as UserProfile);
  if (users.length === 0) return { total: 0, wrote: 0, rate: 0 };
  const wrote = users.filter((u) => (u.writingCount ?? 0) > 0).length;
  return { total: users.length, wrote, rate: wrote / users.length };
}

// 가입일 기준 N일 이내에 한 번이라도 다시 글을 쓴 사용자 비율.
// 최근 가입자 표본(sampleLimit)만 살펴봐 비용을 억제한다.
export async function getRevisitRate(
  days: 7 | 30,
  sampleLimit = 300
): Promise<{ eligibleCount: number; revisitedCount: number; rate: number }> {
  const today = todayDateString();
  const cutoff = addDays(today, -days);

  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(sampleLimit)));
  const users = snap.docs.map((d) => d.data() as UserProfile);
  const eligible = users.filter((u) => timestampToDateString(u.createdAt) <= cutoff);
  if (eligible.length === 0) return { eligibleCount: 0, revisitedCount: 0, rate: 0 };

  const neededDates = new Set<string>();
  const windows = eligible.map((u) => {
    const signupDate = timestampToDateString(u.createdAt);
    const dates = Array.from({ length: days }, (_, i) => addDays(signupDate, i + 1));
    dates.forEach((d) => neededDates.add(d));
    return { uid: u.uid, dates };
  });

  const statsMap = new Map<string, Set<string>>();
  await Promise.all(
    Array.from(neededDates).map(async (date) => {
      const stats = await getDailyStats(date);
      statsMap.set(date, new Set(stats?.activeUserIds ?? []));
    })
  );

  const revisitedCount = windows.filter((w) => w.dates.some((d) => statsMap.get(d)?.has(w.uid))).length;
  return { eligibleCount: eligible.length, revisitedCount, rate: revisitedCount / eligible.length };
}

// 신고된 콘텐츠를 삭제하고 신고를 처리 완료로 표시한다.
export async function deleteReportedContent(report: Report): Promise<void> {
  try {
    if (report.targetType === 'post') {
      const post = await getPostById(report.targetId);
      // deletePost는 댓글/좋아요/저장까지 함께 지우고 원본 글을 비공개로 되돌린다.
      if (post) await deletePost(post.id, post.writingId);
    } else {
      const snap = await getDoc(doc(db, 'comments', report.targetId));
      // deleteComment는 게시물의 commentCount도 함께 맞춘다.
      if (snap.exists()) await deleteComment(report.targetId, (snap.data() as Comment).postId);
    }
  } catch {
    // 이미 삭제된 콘텐츠일 수 있다. 신고 처리는 계속 진행한다.
  }
  await updateDoc(doc(db, 'reports', report.id), { status: 'reviewed' });
}

// 문제가 없다고 판단한 신고를 기각한다.
export async function dismissReport(reportId: string): Promise<void> {
  await updateDoc(doc(db, 'reports', reportId), { status: 'dismissed' });
}
