import AsyncStorage from '@react-native-async-storage/async-storage';

// 네트워크가 끊겨도 작성 중인 내용이 사라지지 않도록 로컬에 임시 저장한다.
// 서버에 정상 저장되면 즉시 지운다.
function draftKey(userId: string, promptId: string): string {
  return `saegim:draft:${userId}:${promptId}`;
}

export async function saveDraft(userId: string, promptId: string, lines: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(draftKey(userId, promptId), JSON.stringify(lines));
  } catch {
    // 로컬 저장 실패는 치명적이지 않으므로 조용히 무시한다.
  }
}

export async function loadDraft(userId: string, promptId: string): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(draftKey(userId, promptId));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export async function clearDraft(userId: string, promptId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(draftKey(userId, promptId));
  } catch {
    // 무시
  }
}

// "연습 새기기"(지난 글감으로 다시 써보기)는 화면에 들어갈 때마다 무작위 글감을 새로
// 뽑는다 — 그래서 promptId로 임시 저장을 찾는 방식(saveDraft/loadDraft)은 안 맞는다.
// 화면을 나갔다 다시 들어오면 이전과 다른 글감이 뽑혀서, 방금 쓰던 글감의 임시 저장을
// 영영 못 찾게 된다. 대신 "그때 뽑혔던 글감 id + 쓰던 내용"을 함께 저장해뒀다가,
// 다음에 들어올 때 새 글감을 뽑는 대신 그 글감과 내용을 그대로 복원한다.
function practiceDraftKey(userId: string): string {
  return `saegim:practiceDraft:${userId}`;
}

export interface PracticeDraft {
  promptId: string;
  lines: string[];
}

export async function savePracticeDraft(userId: string, promptId: string, lines: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(practiceDraftKey(userId), JSON.stringify({ promptId, lines }));
  } catch {
    // 무시
  }
}

export async function loadPracticeDraft(userId: string): Promise<PracticeDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(practiceDraftKey(userId));
    return raw ? (JSON.parse(raw) as PracticeDraft) : null;
  } catch {
    return null;
  }
}

export async function clearPracticeDraft(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(practiceDraftKey(userId));
  } catch {
    // 무시
  }
}

// 오늘의 글감 스티커를 뗐는지 여부. 하루 지나면 새 promptId로 다시 가려진다.
function revealKey(userId: string, promptId: string): string {
  return `saegim:revealed:${userId}:${promptId}`;
}

export async function isPromptRevealed(userId: string, promptId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(revealKey(userId, promptId))) === '1';
  } catch {
    return false;
  }
}

export async function markPromptRevealed(userId: string, promptId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(revealKey(userId, promptId), '1');
  } catch {
    // 무시
  }
}
