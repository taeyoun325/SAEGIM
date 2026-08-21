// 캐릭터 육성 실험: 고를 수 있는 알 10종.
//
// 알마다 완전히 다른 성장 라인을 가진다 — 깨어나는 모습도, 다 자란 성체도 다르다.
// 동물뿐 아니라 정령·몬스터·기계·날씨처럼 상상 속 존재도 섞어 고르는 재미를 준다.
//
// 1~5단계 스프라이트는 "50+ Monsters Pack 2D" (isaiah658, CC0 — 저작자 표시도
// 필요 없음, https://opengameart.org/content/50-monsters-pack-2d) 중 동글동글하고
// 귀여운 디자인만 골라 쓴다. 0단계(알)는 그대로 이모지를 쓴다.

import { STAGE_THRESHOLDS } from './characterGrowth';

export interface SpeciesStage {
  emoji: string;
  label: string;
  minWritingCount: number;
  sprite?: number; // require()된 이미지. 0단계(알)에는 없다.
}

export interface CharacterSpecies {
  id: string;
  eggEmoji: string;
  eggName: string;
  eggHint: string; // 알 선택 화면에서 어떤 계열인지 살짝 귀띔해준다
  stages: SpeciesStage[]; // STAGE_THRESHOLDS와 같은 길이(6단계)
}

// 각 종의 단계 이름만 받아 임계값을 붙여준다(모든 종이 같은 속도로 자란다).
function buildStages(entries: [string, string, number?][]): SpeciesStage[] {
  return entries.map(([emoji, label, sprite], i) => ({
    emoji,
    label,
    sprite,
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
      ['🐣', '포근한 솜털', require('../assets/creatures/chick-1.png')],
      ['🐝', '작은 꿀벌', require('../assets/creatures/chick-2.png')],
      ['🐞', '행운의 무당벌레', require('../assets/creatures/chick-3.png')],
      ['🐥', '복슬복슬 털뭉치', require('../assets/creatures/chick-4.png')],
      ['🦉', '지혜로운 부엉이', require('../assets/creatures/chick-5.png')],
    ]),
  },
  {
    id: 'star',
    eggEmoji: '🔮',
    eggName: '수정 알',
    eggHint: '안에서 별빛이 새어 나와요',
    stages: buildStages([
      ['🔮', '수정 알'],
      ['🐱', '별빛 고양이', require('../assets/creatures/star-1.png')],
      ['🦊', '별빛 여우', require('../assets/creatures/star-2.png')],
      ['🦉', '지혜의 부엉이', require('../assets/creatures/star-3.png')],
      ['🐉', '별빛 이무기', require('../assets/creatures/star-4.png')],
      ['🦄', '별의 수호자', require('../assets/creatures/star-5.png')],
    ]),
  },
  {
    id: 'forest',
    eggEmoji: '🌰',
    eggName: '씨앗 알',
    eggHint: '숲의 냄새가 나요',
    stages: buildStages([
      ['🌰', '씨앗 알'],
      ['🌸', '작은 꽃봉오리', require('../assets/creatures/forest-1.png')],
      ['💧', '이슬 정령', require('../assets/creatures/forest-2.png')],
      ['🍃', '잎사귀 요정', require('../assets/creatures/forest-3.png')],
      ['🐸', '숲속 개구리', require('../assets/creatures/forest-4.png')],
      ['🐢', '숲의 수호거북', require('../assets/creatures/forest-5.png')],
    ]),
  },
  {
    id: 'ocean',
    eggEmoji: '🫧',
    eggName: '물방울 알',
    eggHint: '만지면 찰랑거려요',
    stages: buildStages([
      ['🫧', '물방울 알'],
      ['🐟', '작은 올챙이', require('../assets/creatures/ocean-1.png')],
      ['🐠', '빨간 물고기', require('../assets/creatures/ocean-2.png')],
      ['⭐', '산호 불가사리', require('../assets/creatures/ocean-3.png')],
      ['🐙', '꽃문어', require('../assets/creatures/ocean-4.png')],
      ['🐬', '푸른 돌고래', require('../assets/creatures/ocean-5.png')],
    ]),
  },
  {
    id: 'dragon',
    eggEmoji: '🪨',
    eggName: '돌 알',
    eggHint: '이상하게 뜨거워요',
    stages: buildStages([
      ['🪨', '돌 알'],
      ['🦎', '아기 공룡', require('../assets/creatures/dragon-1.png')],
      ['🐊', '황금 새끼공룡', require('../assets/creatures/dragon-2.png')],
      ['🐲', '점박이 공룡', require('../assets/creatures/dragon-3.png')],
      ['🐉', '청록 공룡', require('../assets/creatures/dragon-4.png')],
      ['🦕', '푸른 거대공룡', require('../assets/creatures/dragon-5.png')],
    ]),
  },
  {
    id: 'frost',
    eggEmoji: '🧊',
    eggName: '얼음 알',
    eggHint: '손이 시려요',
    stages: buildStages([
      ['🧊', '얼음 알'],
      ['❄️', '파란 눈덩이', require('../assets/creatures/frost-1.png')],
      ['☁️', '하얀 구름양', require('../assets/creatures/frost-2.png')],
      ['🐱', '하얀 눈고양이', require('../assets/creatures/frost-3.png')],
      ['🦈', '빙하 상어', require('../assets/creatures/frost-4.png')],
      ['🦣', '털매머드', require('../assets/creatures/frost-5.png')],
    ]),
  },
  {
    id: 'robot',
    eggEmoji: '⚙️',
    eggName: '금속 알',
    eggHint: '안에서 톱니 소리가 나요',
    stages: buildStages([
      ['⚙️', '금속 알'],
      ['🤖', '꼬마 탐사로봇', require('../assets/creatures/robot-1.png')],
      ['🛡️', '장갑 로봇', require('../assets/creatures/robot-2.png')],
      ['⚙️', '톱니 로봇', require('../assets/creatures/robot-3.png')],
      ['🦾', '집게팔 로봇', require('../assets/creatures/robot-4.png')],
      ['🗿', '로봇 골렘', require('../assets/creatures/robot-5.png')],
    ]),
  },
  {
    id: 'spore',
    eggEmoji: '🍄',
    eggName: '포자 알',
    eggHint: '조금 수상해요',
    stages: buildStages([
      ['🍄', '포자 알'],
      ['🟢', '초록 포자', require('../assets/creatures/spore-1.png')],
      ['🐌', '포자 달팽이', require('../assets/creatures/spore-2.png')],
      ['🍄', '버섯 요정', require('../assets/creatures/spore-3.png')],
      ['🐙', '곰팡이 정령', require('../assets/creatures/spore-4.png')],
      ['🥊', '장난꾸러기 복서', require('../assets/creatures/spore-5.png')],
    ]),
  },
  {
    id: 'night',
    eggEmoji: '🌙',
    eggName: '그믐 알',
    eggHint: '밤에만 움직여요',
    stages: buildStages([
      ['🌙', '그믐 알'],
      ['👻', '꼬마 유령', require('../assets/creatures/night-1.png')],
      ['🦇', '박쥐', require('../assets/creatures/night-2.png')],
      ['🦝', '밤의 너구리', require('../assets/creatures/night-3.png')],
      ['🐦‍⬛', '검은 까마귀', require('../assets/creatures/night-4.png')],
      ['🐍', '밤의 뱀', require('../assets/creatures/night-5.png')],
    ]),
  },
  {
    id: 'sky',
    eggEmoji: '☁️',
    eggName: '구름 알',
    eggHint: '둥실 떠 있어요',
    stages: buildStages([
      ['☁️', '구름 알'],
      ['🐛', '작은 애벌레', require('../assets/creatures/sky-1.png')],
      ['🐛', '노랑 애벌레', require('../assets/creatures/sky-2.png')],
      ['🐞', '무당벌레', require('../assets/creatures/sky-3.png')],
      ['☁️', '하얀 구름양', require('../assets/creatures/sky-4.png')],
      ['🐋', '보랏빛 하늘고래', require('../assets/creatures/sky-5.png')],
    ]),
  },
];

export function findSpecies(id: string | null | undefined): CharacterSpecies | null {
  if (!id) return null;
  return CHARACTER_SPECIES.find((s) => s.id === id) ?? null;
}
