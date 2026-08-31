// 글감 풀이 원칙을 지키는지 검사한다.
//   1) 1~5글자          — 길면 읽는 순간 방향이 정해져 버린다
//   2) 한글 단어         — 문장부호(?/!/.)나 공백이 있으면 문장·질문형이라는 뜻이다
//   3) 중복 없음         — 2년 안에 같은 글감이 두 번 나오면 안 된다
//   4) 730개 이상        — 2년(730일)을 하루도 겹치지 않고 채우려면 필요한 최소치
//
// 사용법: node scripts/check-prompt-pool.js
const MIN_LENGTH = 1;
const MAX_LENGTH = 5;
const REQUIRED_COUNT = 730; // 2년

function check(pool) {
  const problems = [];

  if (pool.length < REQUIRED_COUNT) {
    problems.push(`글감이 ${pool.length}개뿐이다 — 2년치(${REQUIRED_COUNT}개)를 채우려면 ${REQUIRED_COUNT - pool.length}개 더 필요하다.`);
  }

  const seen = new Set();
  for (const { title, category } of pool) {
    if (typeof title !== 'string' || typeof category !== 'string') {
      problems.push(`title/category가 문자열이 아니다: ${JSON.stringify({ title, category })}`);
      continue;
    }
    if (title.length < MIN_LENGTH || title.length > MAX_LENGTH) {
      problems.push(`"${title}" — ${title.length}글자. ${MIN_LENGTH}~${MAX_LENGTH}글자여야 한다.`);
    }
    if (!/^[가-힣]+$/.test(title)) {
      problems.push(`"${title}" — 한글 단어 하나가 아니다(공백·문장부호·영문 등이 섞였다).`);
    }
    if (seen.has(title)) {
      problems.push(`"${title}" — 중복.`);
    }
    seen.add(title);
  }

  return problems;
}

module.exports = { check, REQUIRED_COUNT };

if (require.main === module) {
  const { PROMPT_POOL } = require('./prompt-pool');
  const problems = check(PROMPT_POOL);
  if (problems.length === 0) {
    const lengths = {};
    PROMPT_POOL.forEach((p) => {
      lengths[p.title.length] = (lengths[p.title.length] ?? 0) + 1;
    });
    const categories = {};
    PROMPT_POOL.forEach((p) => {
      categories[p.category] = (categories[p.category] ?? 0) + 1;
    });
    console.log(`통과 — 글감 ${PROMPT_POOL.length}개 (2년치 ${REQUIRED_COUNT}개 충족)`);
    console.log('글자수 분포:', lengths);
    console.log('카테고리 분포:', categories);
    process.exit(0);
  }
  console.error(`실패 — ${problems.length}건`);
  problems.forEach((p) => console.error(' -', p));
  process.exit(1);
}
