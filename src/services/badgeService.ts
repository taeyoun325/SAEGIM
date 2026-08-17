import { BADGE_DEFS, BadgeDef } from '../constants/badges';
import { UserProfile } from '../types/models';
import { updateUserProfile } from './userService';

// 스트릭/누적 작성 수 기준으로 새로 딴 배지를 찾아 프로필에 영구 기록한다.
// 한번 딴 배지는 이후 스트릭이 끊겨도 유지된다.
export async function evaluateAndAwardBadges(uid: string, profile: UserProfile): Promise<BadgeDef[]> {
  const earned = new Set(profile.earnedBadgeIds ?? []);
  const newlyEarned = BADGE_DEFS.filter((b) => {
    if (earned.has(b.id)) return false;
    const value = b.type === 'streak' ? profile.streakCount : profile.writingCount;
    return value >= b.threshold;
  });

  if (newlyEarned.length === 0) return [];

  const nextIds = [...earned, ...newlyEarned.map((b) => b.id)];
  await updateUserProfile(uid, { earnedBadgeIds: nextIds });
  return newlyEarned;
}
