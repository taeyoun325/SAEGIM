import { doc, serverTimestamp, WriteBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

export type RateLimitedAction = 'comment' | 'writing';

// 쿨다운 기록은 반드시 실제 쓰기와 "같은 배치"에 넣어야 한다.
// 보안 규칙이 getAfter()로 이 커밋에서 갱신됐는지 확인하기 때문에,
// 따로 쓰면 규칙이 통과하지 않는다.
// serverTimestamp()는 규칙에서 request.time으로 평가되므로 시각을 위조할 수 없다.
export function stampRateLimit(batch: WriteBatch, userId: string, action: RateLimitedAction): void {
  batch.set(doc(db, 'rateLimits', userId, 'actions', action), { at: serverTimestamp() });
}

export const COOLDOWN_MESSAGE: Record<RateLimitedAction, string> = {
  comment: '댓글은 15초에 한 번 쓸 수 있어요. 잠시 후 다시 시도해주세요.',
  writing: '조금 전에 글을 새겼어요. 잠시 후 다시 시도해주세요.',
};

// 쿨다운에 걸리면 규칙이 permission-denied로 거절한다.
// 권한 문제와 구분할 수 없으므로, 쿨다운이 걸린 경로에서만 이 판정을 쓴다.
export function isPermissionDenied(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'permission-denied';
}
