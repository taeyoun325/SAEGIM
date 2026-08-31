// scripts/prompt-pool.js(원본)에서 앱 번들용 src/constants/promptPool.ts를 생성한다.
// 두 곳에 같은 목록을 손으로 유지하면 반드시 어긋나므로 한쪽을 원본으로 삼는다.
//
// 사용법: node scripts/gen-prompt-pool.js
const fs = require('fs');
const path = require('path');
const { PROMPT_POOL, PROMPT_CATEGORIES } = require('./prompt-pool');
const { check } = require('./check-prompt-pool');

const OUT = path.join(__dirname, '..', 'src', 'constants', 'promptPool.ts');

// 규칙을 어긴 목록이 앱까지 흘러가지 않도록 생성 전에 먼저 막는다.
const problems = check(PROMPT_POOL);
if (problems.length > 0) {
  console.error('글감 풀 규칙 위반 — 생성을 중단한다:');
  problems.forEach((p) => console.error(' -', p));
  process.exit(1);
}

const header = `// 글감 예비 풀(fallback pool).
//
// Firestore에 해당 날짜의 글감 문서가 없을 때 이 목록에서 날짜 기반으로 하나를 골라 쓴다.
// 날짜만으로 결정되므로 서버 없이도 모든 사용자가 같은 날 같은 글감을 보게 된다.
// (Spark 무료 요금제라 Cloud Functions로 매일 생성할 수 없어 이 방식을 쓴다.)
//
// ⚠️ 이 파일은 자동 생성된다. 직접 고치지 말고 scripts/prompt-pool.js를 고친 뒤
//    "node scripts/gen-prompt-pool.js"로 다시 만든다 — 두 풀이 어긋나면 서버가 주는
//    글감과 오프라인 글감이 달라진다.
//
// ⚠️ 글감 원칙: 1~5글자 · 일상에서 쓰는 단어 · 열린 말만.
//    "사랑하는 사람"처럼 무엇을 쓸지 지정하는 문장·질문형은 넣지 않는다.
//    같은 말을 받아도 백 사람이 백 가지를 쓸 수 있어야 한다.
//
// 730개 이상이라 2년(730일) 동안 같은 글감이 두 번 나오지 않는다.
export interface PromptSeed {
  title: string;
  category: string;
}

// PROMPT_POOL에 실제로 쓰인 카테고리 전체 목록(선호 카테고리 선택, 관리자 글감 추가 폼에서 재사용).
export const PROMPT_CATEGORIES = [${PROMPT_CATEGORIES.map((c) => `'${c}'`).join(', ')}];

export const PROMPT_POOL: PromptSeed[] = [
`;

const body = PROMPT_POOL.map((p) => `  { title: '${p.title}', category: '${p.category}' },`).join('\n');

fs.writeFileSync(OUT, `${header}${body}\n];\n`, 'utf8');
console.log(`src/constants/promptPool.ts 생성 완료 — 글감 ${PROMPT_POOL.length}개`);
