import { BLOCKED_NICKNAME_WORDS, NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '../constants/config';

export function validateNickname(nickname: string): { valid: boolean; reason?: string } {
  const trimmed = nickname.trim();
  if (trimmed.length < NICKNAME_MIN_LENGTH || trimmed.length > NICKNAME_MAX_LENGTH) {
    return { valid: false, reason: `닉네임은 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자여야 해요.` };
  }
  const lower = trimmed.toLowerCase();
  if (BLOCKED_NICKNAME_WORDS.some((word) => lower.includes(word.toLowerCase()))) {
    return { valid: false, reason: '사용할 수 없는 닉네임이에요.' };
  }
  if (!/^[가-힣a-zA-Z0-9_. ]+$/.test(trimmed)) {
    return { valid: false, reason: '한글, 영문, 숫자만 사용할 수 있어요.' };
  }
  return { valid: true };
}
