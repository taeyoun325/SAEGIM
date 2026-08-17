import { BADGE_DEFS, BadgeDef } from '../constants/badges';
import { UserProfile } from '../types/models';
import { updateUserProfile } from './userService';

export const MAX_STREAK_FREEZES = 3;

export interface BadgeAwardResult {
  newBadges: BadgeDef[];
  freezesGained: number;
}

// 스트릭/누적 작성 수/누적 좋아요 수 기준으로 새로 딴 배지를 찾아 프로필에 영구 기록한다.
// 한번 딴 배지는 이후 스트릭이 끊기거나 좋아요가 취소돼도 유지된다.
// totalLikesReceived는 프로필에 저장되는 값이 아니라(다른 사용자가 좋아요를 누를 때마다
// users 문서를 직접 고치게 하면 보안 규칙이 복잡해지므로), 호출부에서 본인 게시물의
// likeCount 합계를 그때그때 계산해 넘겨준다.
export async function evaluateAndAwardBadges(
  uid: string,
  profile: UserProfile,
  totalLikesReceived = 0
): Promise<BadgeAwardResult> {
  const earned = new Set(profile.earnedBadgeIds ?? []);
  const newlyEarned = BADGE_DEFS.filter((b) => {
    if (earned.has(b.id)) return false;
    const value = b.type === 'streak' ? profile.streakCount : b.type === 'writing' ? profile.writingCount : totalLikesReceived;
    return value >= b.threshold;
  });

  if (newlyEarned.length === 0) return { newBadges: [], freezesGained: 0 };

  // 스트릭 배지를 딸 때마다 연속기록 보호권을 하나씩 준다(최대 보유 개수는 제한).
  const streakBadgesEarned = newlyEarned.filter((b) => b.type === 'streak').length;
  const currentFreezes = profile.streakFreezes ?? 0;
  const nextFreezes = Math.min(MAX_STREAK_FREEZES, currentFreezes + streakBadgesEarned);

  const nextIds = [...earned, ...newlyEarned.map((b) => b.id)];
  await updateUserProfile(uid, { earnedBadgeIds: nextIds, streakFreezes: nextFreezes });
  return { newBadges: newlyEarned, freezesGained: nextFreezes - currentFreezes };
}
