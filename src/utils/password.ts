export type PasswordStrength = 'weak' | 'medium' | 'strong';

export const PASSWORD_STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: '약함',
  medium: '보통',
  strong: '강함',
};

// 외부 라이브러리 없이 쓰는 단순 휴리스틱. 정확한 엔트로피 계산이 목적이 아니라,
// "123456"처럼 뻔한 비밀번호와 "길고 여러 문자 종류를 섞은" 비밀번호를 시각적으로
// 구분해 보여주는 정도의 가벼운 안내다.
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 6) return 'weak';

  let varietyCount = 0;
  if (/[a-z]/.test(password)) varietyCount++;
  if (/[A-Z]/.test(password)) varietyCount++;
  if (/[0-9]/.test(password)) varietyCount++;
  if (/[^a-zA-Z0-9]/.test(password)) varietyCount++;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  score += varietyCount >= 2 ? 1 : 0;
  score += varietyCount >= 3 ? 1 : 0;

  // 같은 문자 반복("aaaaaa")이나 순서대로 이어지는 숫자("123456")처럼 뻔한 패턴은
  // 길이/문자 종류가 충분해 보여도 강도를 한 단계 낮춘다.
  const isObvious = /^(.)\1+$/.test(password) || /^(?:0123456789|1234567890|123456|654321|abcdef|qwerty)+$/i.test(password);
  if (isObvious) score = 0;

  if (score >= 3) return 'strong';
  if (score >= 1) return 'medium';
  return 'weak';
}
