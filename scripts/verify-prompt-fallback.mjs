// 글감 폴백이 "같은 날 = 같은 글감"을 보장하는지 검증한다.
// promptService의 계산식과 동일한 로직을 복제해 여러 날짜를 확인한다.
import { readFileSync } from 'node:fs';

const poolSrc = readFileSync(new URL('../src/constants/promptPool.ts', import.meta.url), 'utf8');
const titles = [...poolSrc.matchAll(/\{ title: '([^']+)', category: '([^']+)' \}/g)].map((m) => ({
  title: m[1],
  category: m[2],
}));

function fallbackFor(promptId) {
  const date = `${promptId.slice(0, 4)}-${promptId.slice(4, 6)}-${promptId.slice(6, 8)}`;
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const index = ((dayNumber % titles.length) + titles.length) % titles.length;
  return { date, ...titles[index] };
}

console.log(`풀 크기: ${titles.length}개`);

let fail = 0;

// 1) 결정론성: 같은 날짜는 항상 같은 결과
const a = fallbackFor('20280901');
const b = fallbackFor('20280901');
if (a.title !== b.title) {
  console.log('FAIL 결정론성');
  fail++;
} else {
  console.log(`PASS 결정론성 — 2028-09-01 = "${a.title}"`);
}

// 2) 연속된 날짜는 서로 다른 글감(풀 크기만큼은 겹치지 않음)
const seen = new Set();
let distinct = true;
for (let d = 1; d <= titles.length; d++) {
  const id = `202809${String(d).padStart(2, '0')}`;
  if (d > 30) break;
  const t = fallbackFor(id).title;
  if (seen.has(t)) distinct = false;
  seen.add(t);
}
if (!distinct) {
  console.log('FAIL 연속 날짜 중복');
  fail++;
} else {
  console.log(`PASS 연속 30일 글감 중복 없음`);
}

// 3) 시드가 끝난 이후(2028년 이후)에도 항상 값이 나온다
const future = fallbackFor('20350101');
if (!future.title) {
  console.log('FAIL 미래 날짜');
  fail++;
} else {
  console.log(`PASS 미래 날짜 — 2035-01-01 = "${future.title}"`);
}

console.log(fail === 0 ? '\n=== 폴백 검증 통과 ===' : `\n=== ${fail}건 실패 ===`);
process.exit(fail === 0 ? 0 : 1);
