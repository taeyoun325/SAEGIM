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
import { createNotification } from './inboxService';

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
  // 앱을 연 사용자 기준(실제 DAU/WAU/MAU)
  dau: number;
  wau: number;
  mau: number;
  // 글을 쓴 사용자 기준
  writerDau: number;
  writerWau: number;
  writerMau: number;
  // 최근 30일 퍼널 이벤트 합계
  events: Record<string, number>;
}

// DAU/WAU/MAU. dailyStats의 uid 배열을 기간별로 합집합해 중복 없이 센다.
// openUserIds = 앱을 연 사람(실제 DAU), activeUserIds = 글을 쓴 사람.
// 최근 30일 문서를 날짜 범위 쿼리 한 번으로 가져온다(최대 30 read).
export async function getActiveUserMetrics(): Promise<ActiveUserMetrics> {
  const today = todayDateString();
  const monthFrom = addDays(today, -29); // 오늘 포함 30일
  const weekFrom = addDays(today, -6); // 오늘 포함 7일

  const snap = await getDocs(
    query(collection(db, dailyStatsCol), where('date', '>=', monthFrom), where('date', '<=', today))
  );

  const open = { d: new Set<string>(), w: new Set<string>(), m: new Set<string>() };
  const writer = { d: new Set<string>(), w: new Set<string>(), m: new Set<string>() };
  const events: Record<string, number> = {};

  const collect = (bucket: typeof open, ids: string[], date: string) => {
    ids.forEach((id) => bucket.m.add(id));
    if (date >= weekFrom) ids.forEach((id) => bucket.w.add(id));
    if (date === today) ids.forEach((id) => bucket.d.add(id));
  };

  snap.docs.forEach((d) => {
    const stats = d.data() as DailyStats;
    collect(open, stats.openUserIds ?? [], stats.date);
    collect(writer, stats.activeUserIds ?? [], stats.date);
    Object.entries(stats.events ?? {}).forEach(([name, count]) => {
      events[name] = (events[name] ?? 0) + count;
    });
  });

  return {
    dau: open.d.size,
    wau: open.w.size,
    mau: open.m.size,
    writerDau: writer.d.size,
    writerWau: writer.w.size,
    writerMau: writer.m.size,
    events,
  };
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

// 신고 대상이 걸려 있는 게시물 id를 찾는다. post 신고면 targetId 그대로,
// comment 신고면 그 댓글이 달린 게시물 id를 조회해야 한다.
// 신고 처리 결과를 알릴 때 어느 게시물에 대한 알림인지 남기는 데 쓴다.
async function resolveReportPostId(report: Report): Promise<string | null> {
  if (report.targetType === 'post') return report.targetId;
  const snap = await getDoc(doc(db, 'comments', report.targetId));
  return snap.exists() ? ((snap.data() as Comment).postId ?? null) : null;
}

// 신고된 콘텐츠를 삭제하고 신고를 처리 완료로 표시한다.
// 신고자에게는 "처리됐다"는 결과를 알려준다 — 신고하고 나서 아무 반응이 없으면
// 신고 기능 자체를 신뢰하지 않게 된다(신뢰·안전 UX의 기본 원칙).
// 글쓴이 본인에게도 알려야 한다 — 지금까지는 자기 글/댓글이 아무 설명 없이
// 사라졌었다("이유도 모른 채 지워졌다"는 게 신뢰·안전 프로세스에서 흔히
// 지적되는 불투명성 문제다). 삭제 전에 작성자 uid를 미리 읽어둔다(지운 뒤엔
// 문서가 없어 알 수 없다).
export async function deleteReportedContent(report: Report, adminUid: string): Promise<void> {
  const postId = await resolveReportPostId(report);
  let authorId: string | null = null;

  // "이미 지워진 콘텐츠"는 아래 존재 여부 검사로 조용히 넘어간다. 그 밖의 실패(권한 오류,
  // 네트워크 등)는 절대 삼키면 안 된다 — 삼키면 콘텐츠는 그대로 남은 채 신고만
  // "처리 완료"로 닫히고, 신고자에게는 조치했다는 알림까지 가버린다.
  // 호출부(AdminReportsScreen)가 오류를 받아 "삭제에 실패했어요"를 띄우고 신고를
  // 목록에 남겨두므로, 여기서는 그대로 던지는 것이 맞다.
  if (report.targetType === 'post') {
    const post = await getPostById(report.targetId);
    authorId = post?.userId ?? null;
    // deletePost는 댓글/좋아요/저장까지 함께 지우고 원본 글을 비공개로 되돌린다.
    if (post) await deletePost(post.id, post.writingId);
  } else {
    const snap = await getDoc(doc(db, 'comments', report.targetId));
    if (snap.exists()) {
      const comment = snap.data() as Comment;
      authorId = comment.userId;
      // deleteComment는 게시물의 commentCount도 함께 맞춘다.
      await deleteComment(report.targetId, comment.postId);
    }
  }

  await updateDoc(doc(db, 'reports', report.id), { status: 'reviewed' });
  // 콘텐츠가 이미 지워졌으므로 postId를 못 찾은 경우(드묾)에는 알림을 보내지 않는다
  // — AppNotification.postId는 필수 필드라 빈 값을 넣을 수 없다.
  if (postId) {
    createNotification(report.reporterId, adminUid, 'report_resolved', postId).catch(() => {});
    if (authorId) {
      createNotification(authorId, adminUid, 'content_removed', postId).catch(() => {});
    }
  }
}

// 문제가 없다고 판단한 신고를 기각한다.
export async function dismissReport(report: Report, adminUid: string): Promise<void> {
  const postId = await resolveReportPostId(report);
  await updateDoc(doc(db, 'reports', report.id), { status: 'dismissed' });
  if (postId) {
    createNotification(report.reporterId, adminUid, 'report_dismissed', postId).catch(() => {});
  }
}
