import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DailyPrompt } from '../types/models';
import { dateStringToPromptId, todayDateString } from '../utils/date';
import { PROMPT_POOL } from '../constants/promptPool';

const promptsCol = 'prompts';

// promptId(YYYYMMDD)를 날짜 문자열(YYYY-MM-DD)로 되돌린다.
function promptIdToDateString(promptId: string): string {
  return `${promptId.slice(0, 4)}-${promptId.slice(4, 6)}-${promptId.slice(6, 8)}`;
}

// 날짜를 "1970-01-01로부터 며칠째"로 바꿔 글감 풀의 인덱스로 쓴다.
// 날짜만으로 결정되므로 서버가 없어도 모든 사용자가 같은 날 같은 글감을 보게 된다.
function fallbackPromptFor(promptId: string): DailyPrompt | null {
  if (!/^\d{8}$/.test(promptId)) return null;

  const date = promptIdToDateString(promptId);
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  if (Number.isNaN(dayNumber)) return null;

  const index = ((dayNumber % PROMPT_POOL.length) + PROMPT_POOL.length) % PROMPT_POOL.length;
  const seed = PROMPT_POOL[index];

  return { id: promptId, date, title: seed.title, category: seed.category, createdAt: 0 };
}

// 글감 조회. Firestore에 시드된 문서가 있으면 그것을 쓰고(운영자가 직접 고른 글감이 우선),
// 없으면 날짜 기반 폴백을 돌려준다. 덕분에 시드가 소진돼도 앱이 빈 화면이 되지 않는다.
export async function getPromptById(id: string): Promise<DailyPrompt | null> {
  try {
    const snap = await getDoc(doc(db, promptsCol, id));
    if (snap.exists()) return snap.data() as DailyPrompt;
  } catch {
    // 네트워크 오류 등은 폴백으로 처리한다.
  }
  return fallbackPromptFor(id);
}

export async function getTodayPrompt(): Promise<DailyPrompt | null> {
  return getPromptById(dateStringToPromptId(todayDateString()));
}
