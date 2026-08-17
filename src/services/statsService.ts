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
