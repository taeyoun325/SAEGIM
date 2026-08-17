import { doc, setDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../config/firebase';
import { todayDateString } from '../utils/date';

const dailyStatsCol = 'dailyStats';

interface BumpOptions {
  newSignups?: number;
  writingsCount?: number;
  commentsCount?: number;
  likesCount?: number;
  activeUserId?: string;
}

// 관리자 통계용 일별 집계 카운터를 갱신한다. 원문 콘텐츠는 담지 않는다.
// 실패해도 사용자 흐름을 막지 않도록 호출부에서 결과를 기다리지 않아도 되게 설계됐다.
export async function bumpDailyStats(opts: BumpOptions): Promise<void> {
  const date = todayDateString();
  const data: Record<string, unknown> = { date };
  if (opts.newSignups) data.newSignups = increment(opts.newSignups);
  if (opts.writingsCount) data.writingsCount = increment(opts.writingsCount);
  if (opts.commentsCount) data.commentsCount = increment(opts.commentsCount);
  if (opts.likesCount) data.likesCount = increment(opts.likesCount);
  if (opts.activeUserId) data.activeUserIds = arrayUnion(opts.activeUserId);
  await setDoc(doc(db, dailyStatsCol, date), data, { merge: true });
}

// 이탈 지점을 찾기 위한 퍼널 이벤트.
// Firebase Analytics(JS SDK)는 웹 전용이고 GA4 데이터를 앱에서 되읽을 수도 없어서,
// 이미 쓰고 있는 dailyStats 카운터 방식을 그대로 확장한다(웹/네이티브 공통, 대시보드에서 바로 조회).
// 이벤트 하나 = 문서 쓰기 하나이므로, 탭 단위가 아니라 퍼널 분기점만 굵게 남긴다.
export type AnalyticsEvent =
  | 'app_open' // 앱 실행(세션당 1회)
  | 'prompt_reveal' // 오늘의 글감 확인
  | 'write_start' // 글쓰기 시작(첫 타이핑)
  | 'write_save' // 새기기(비공개 저장)
  | 'publish' // 게시하기
  | 'share_open' // 공유 카드 테마 선택 열기
  | 'share_done' // 공유/저장 완료
  | 'post_save' // 다른 사람 글 저장(북마크)
  | 'badge_earned'; // 배지 획득

export async function logEvent(event: AnalyticsEvent, uid?: string): Promise<void> {
  const date = todayDateString();
  const data: Record<string, unknown> = {
    date,
    events: { [event]: increment(1) },
  };
  // app_open은 "오늘 앱을 연 사람"을 중복 없이 세기 위해 uid도 모은다.
  // 글을 쓴 사람만 담기는 activeUserIds와 달리 이쪽이 실제 DAU 기준이 된다.
  if (event === 'app_open' && uid) data.openUserIds = arrayUnion(uid);
  await setDoc(doc(db, dailyStatsCol, date), data, { merge: true });
}
