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
