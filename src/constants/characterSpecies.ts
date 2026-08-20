// 캐릭터 육성 실험: 고를 수 있는 알 10종.
//
// 알마다 완전히 다른 성장 라인을 가진다 — 깨어나는 모습도, 다 자란 성체도 다르다.
// 동물뿐 아니라 정령·몬스터·기계·날씨처럼 상상 속 존재도 섞어 고르는 재미를 준다.
//
// 스프라이트 대신 이모지를 쓰는 이유와 조사해둔 무료(CC0) 자산 출처는
// constants/characterGrowth.ts 상단 주석 참고.

import { STAGE_THRESHOLDS } from './characterGrowth';

export interface SpeciesStage {
  emoji: string;
  label: string;
  minWritingCount: number;
}

export interface CharacterSpecies {
  id: string;
  eggEmoji: string;
  eggName: string;
  eggHint: string; // 알 선택 화면에서 어떤 계열인지 살짝 귀띔해준다
  stages: SpeciesStage[]; // STAGE_THRESHOLDS와 같은 길이(6단계)
}

// 각 종의 단계 이름만 받아 임계값을 붙여준다(모든 종이 같은 속도로 자란다).
function buildStages(entries: [string, string][]): SpeciesStage[] {
  return entries.map(([emoji, label], i) => ({
    emoji,
    label,
    minWritingCount: STAGE_THRESHOLDS[i],
  }));
}

export const CHARACTER_SPECIES: CharacterSpecies[] = [
  {
    id: 'chick',
    eggEmoji: '🥚',
    eggName: '흰 알',
    eggHint: '평범해 보이지만 가장 따뜻해요',
    stages: buildStages([
      ['🥚', '흰 알'],
      ['🐣', '갓 깨어난 아이'],
      ['🐤', '노란 병아리'],
      ['🐔', '늠름한 닭'],
      ['🦃', '위풍당당'],
      ['🦚', '화려한 공작'],
    ]),
  },
  {
    id: 'star',
    eggEmoji: '🔮',
    eggName: '수정 알',
    eggHint: '안에서 별빛이 새어 나와요',
    stages: buildStages([
      ['🔮', '수정 알'],
      ['✨', '반짝임'],
      ['⭐', '작은 별'],
      ['🌟', '빛나는 별'],
      ['☄️', '혜성'],
      ['🌌', '은하'],
    ]),
  },
  {
    id: 'forest',
    eggEmoji: '🌰',
    eggName: '씨앗 알',
    eggHint: '숲의 냄새가 나요',
    stages: buildStages([
      ['🌰', '씨앗 알'],
      ['🌱', '새싹'],
      ['🌿', '어린 덩굴'],
      ['🌳', '큰 나무'],
      ['🧚', '숲의 요정'],
      ['🧝', '숲의 수호자'],
    ]),
  },
  {
    id: 'ocean',
    eggEmoji: '🫧',
    eggName: '물방울 알',
    eggHint: '만지면 찰랑거려요',
    stages: buildStages([
      ['🫧', '물방울 알'],
      ['🐟', '작은 물고기'],
      ['🐠', '열대어'],
      ['🐡', '복어'],
      ['🐬', '돌고래'],
      ['🐋', '고래'],
    ]),
  },
  {
    id: 'dragon',
    eggEmoji: '🪨',
    eggName: '돌 알',
    eggHint: '이상하게 뜨거워요',
    stages: buildStages([
      ['🪨', '돌 알'],
      ['🦎', '도마뱀'],
      ['🐍', '뱀'],
      ['🐊', '악어'],
      ['🐲', '아기 용'],
      ['🐉', '용'],
    ]),
  },
  {
    id: 'frost',
    eggEmoji: '🧊',
    eggName: '얼음 알',
    eggHint: '손이 시려요',
    stages: buildStages([
      ['🧊', '얼음 알'],
      ['❄️', '눈송이'],
      ['⛄', '눈사람'],
      ['🐧', '펭귄'],
      ['🦭', '바다표범'],
      ['🦣', '털매머드'],
    ]),
  },
  {
    id: 'robot',
    eggEmoji: '⚙️',
    eggName: '금속 알',
    eggHint: '안에서 톱니 소리가 나요',
    stages: buildStages([
      ['⚙️', '금속 알'],
      ['🔩', '나사 뭉치'],
      ['🤖', '꼬마 로봇'],
      ['🦾', '강화 로봇'],
      ['🛸', '비행 유닛'],
      ['🚀', '우주선'],
    ]),
  },
  {
    id: 'spore',
    eggEmoji: '🍄',
    eggName: '포자 알',
    eggHint: '조금 수상해요',
    stages: buildStages([
      ['🍄', '포자 알'],
      ['👾', '작은 몬스터'],
      ['🧌', '트롤'],
      ['👹', '도깨비'],
      ['👺', '붉은 요괴'],
      ['🗿', '거대 석상'],
    ]),
  },
  {
    id: 'night',
    eggEmoji: '🌙',
    eggName: '그믐 알',
    eggHint: '밤에만 움직여요',
    stages: buildStages([
      ['🌙', '그믐 알'],
      ['👻', '꼬마 유령'],
      ['🦇', '박쥐'],
      ['🐺', '늑대'],
      ['🧛', '뱀파이어'],
      ['🌚', '밤의 주인'],
    ]),
  },
  {
    id: 'sky',
    eggEmoji: '☁️',
    eggName: '구름 알',
    eggHint: '둥실 떠 있어요',
    stages: buildStages([
      ['☁️', '구름 알'],
      ['💨', '산들바람'],
      ['🌦️', '소나기'],
      ['⚡', '번개'],
      ['⛈️', '폭풍'],
      ['🌪️', '태풍'],
    ]),
  },
];

export function findSpecies(id: string | null | undefined): CharacterSpecies | null {
  if (!id) return null;
  return CHARACTER_SPECIES.find((s) => s.id === id) ?? null;
}
