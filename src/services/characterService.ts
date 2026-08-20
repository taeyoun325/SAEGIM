import { CHARACTER_STAGES, CharacterStageDef } from '../constants/characterGrowth';
import { CHARACTER_ACCESSORIES, CharacterAccessoryDef } from '../constants/characterAccessories';
import { UserProfile } from '../types/models';
import { updateUserProfile } from './userService';
import { todayDateString } from '../utils/date';

export interface CharacterProgress {
  stage: CharacterStageDef;
  nextStage: CharacterStageDef | null;
  writingCount: number;
  progressToNext: number; // 0~1, 다음 단계가 없으면 1
}

// v1 성장 지표는 profile.writingCount(총 새김 수)를 그대로 쓴다 — 이미 프로필에
// 있는 값이라 새 카운터/쓰기 로직이 필요 없다. 스트릭이나 기분처럼 다른 요소를
// 섞어 경험치를 계산하는 건(예: 연속 기록 보너스) 다음 단계 과제로 남겨둔다.
export function getCharacterProgress(profile: Pick<UserProfile, 'writingCount'>): CharacterProgress {
  const writingCount = profile.writingCount ?? 0;
  let stage = CHARACTER_STAGES[0];
  let nextStage: CharacterStageDef | null = null;

  for (let i = 0; i < CHARACTER_STAGES.length; i++) {
    if (writingCount >= CHARACTER_STAGES[i].minWritingCount) {
      stage = CHARACTER_STAGES[i];
      nextStage = CHARACTER_STAGES[i + 1] ?? null;
    }
  }

  const progressToNext = nextStage
    ? (writingCount - stage.minWritingCount) / (nextStage.minWritingCount - stage.minWritingCount)
    : 1;

  return { stage, nextStage, writingCount, progressToNext: Math.min(1, Math.max(0, progressToNext)) };
}

// 먹이 주기: 글쓰기와 별개로 매일 한 번 캐릭터와 상호작용하는 요소(Finch류 앱 참고).
// 성장 자체(단계)는 여전히 새김 개수로만 결정되고, 애정도는 순수히 꾸미기 아이템
// 해금용 보조 지표라 성장 로직과 섞이지 않는다.
export function canFeedToday(profile: Pick<UserProfile, 'characterLastFedDate'>): boolean {
  return profile.characterLastFedDate !== todayDateString();
}

export async function feedCharacter(
  uid: string,
  profile: Pick<UserProfile, 'characterAffection' | 'characterLastFedDate'>
): Promise<void> {
  if (!canFeedToday(profile)) return;
  const nextAffection = (profile.characterAffection ?? 0) + 1;
  await updateUserProfile(uid, { characterAffection: nextAffection, characterLastFedDate: todayDateString() });
}

export function getUnlockedAccessories(affection: number): CharacterAccessoryDef[] {
  return CHARACTER_ACCESSORIES.filter((a) => affection >= a.minAffection);
}

export function getNextLockedAccessory(affection: number): CharacterAccessoryDef | null {
  return CHARACTER_ACCESSORIES.find((a) => affection < a.minAffection) ?? null;
}

export async function equipAccessory(uid: string, accessoryId: string): Promise<void> {
  await updateUserProfile(uid, { characterEquippedAccessoryId: accessoryId });
}
