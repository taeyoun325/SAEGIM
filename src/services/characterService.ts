import { CHARACTER_SPECIES, CharacterSpecies, SpeciesStage, findSpecies } from '../constants/characterSpecies';
import { CHARACTER_ACCESSORIES, CharacterAccessoryDef } from '../constants/characterAccessories';
import { UserProfile } from '../types/models';
import { updateUserProfile } from './userService';
import { todayDateString } from '../utils/date';

export { CHARACTER_SPECIES, findSpecies };
export type { CharacterSpecies };

export interface SpeciesProgress {
  species: CharacterSpecies;
  stage: SpeciesStage;
  stageIndex: number;
  nextStage: SpeciesStage | null;
  writingCount: number;
  progressToNext: number; // 0~1, 다음 단계가 없으면 1
}

// v1 성장 지표는 profile.writingCount(총 새김 수)를 그대로 쓴다 — 이미 프로필에
// 있는 값이라 새 카운터/쓰기 로직이 필요 없다. 스트릭이나 기분처럼 다른 요소를
// 섞어 경험치를 계산하는 건(예: 연속 기록 보너스) 다음 단계 과제로 남겨둔다.
export function getSpeciesProgress(
  profile: Pick<UserProfile, 'writingCount'>,
  species: CharacterSpecies
): SpeciesProgress {
  const writingCount = profile.writingCount ?? 0;
  let stageIndex = 0;
  for (let i = 0; i < species.stages.length; i++) {
    if (writingCount >= species.stages[i].minWritingCount) stageIndex = i;
  }
  const stage = species.stages[stageIndex];
  const nextStage = species.stages[stageIndex + 1] ?? null;
  const progressToNext = nextStage
    ? (writingCount - stage.minWritingCount) / (nextStage.minWritingCount - stage.minWritingCount)
    : 1;

  return {
    species,
    stage,
    stageIndex,
    nextStage,
    writingCount,
    progressToNext: Math.min(1, Math.max(0, progressToNext)),
  };
}

// 알을 고르면 그 순간부터 성장이 시작된다(이미 있는 writingCount로 바로 몇 단계
// 앞서 있을 수도 있다 — 알을 새로 골라도 지금까지 새긴 기록 자체는 그대로다).
export async function selectCharacterSpecies(uid: string, speciesId: string): Promise<void> {
  await updateUserProfile(uid, { characterSpeciesId: speciesId });
}

// 개발자 서버 모드 전용: 다른 알로 처음부터 다시 키워보고 싶을 때 쓴다.
// writingCount(실제 새긴 기록)는 손대지 않는다 — 캐릭터 쪽 상태만 초기화한다.
export async function resetCharacter(uid: string): Promise<void> {
  await updateUserProfile(uid, {
    characterSpeciesId: null,
    characterAffection: 0,
    characterLastFedDate: null,
    characterEquippedAccessoryId: null,
  });
}

// 먹이 주기: 글쓰기와 별개로 매일 한 번 캐릭터와 상호작용하는 요소(Finch류 앱 참고).
// 성장 자체(단계)는 여전히 새김 개수로만 결정되고, 애정도는 순수히 꾸미기 아이템
// 해금용 보조 지표라 성장 로직과 섞이지 않는다.
export function canFeedToday(profile: Pick<UserProfile, 'characterLastFedDate'>): boolean {
  return profile.characterLastFedDate !== todayDateString();
}

// unlimited는 개발자 서버 모드에서만 켜진다 — 하루 제한 없이 마음껏 먹여보며
// 애정도/해금 단계를 바로 확인할 수 있게 한다. 실제 서비스로 나가면 꺼야 한다.
export async function feedCharacter(
  uid: string,
  profile: Pick<UserProfile, 'characterAffection' | 'characterLastFedDate'>,
  options?: { unlimited?: boolean }
): Promise<void> {
  if (!options?.unlimited && !canFeedToday(profile)) return;
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
