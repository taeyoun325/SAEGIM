// DailyPrompt 시드 스크립트. 오늘부터 N일치 글감을 채운다.
// 이미 존재하는 날짜는 건드리지 않아 여러 번 실행해도 안전하다.
//
// 사용법: node scripts/seed-prompts.js [days] [--overwrite]
//   --overwrite : 이미 있는 날짜도 새 글감으로 덮어쓴다(글감 풀을 갈아엎었을 때 쓴다).
//
// ⚠️ 어느 모드든 항상 "오늘"부터 채운다 — 과거 날짜는 사용자가 이미 그 글감을 보고
//    글을 쓴 날이라, 덮어쓰면 내가 쓴 글과 캘린더에 뜨는 글감이 어긋나 버린다.
//    같은 이유로 --overwrite는 "이미 그 날짜로 쓴 글이 있는" 날도 건너뛴다. 오늘은
//    아침에 벌써 누군가 글을 썼을 수 있어 날짜만으로는 안전하다고 볼 수 없다.
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { PROMPT_POOL } = require('./prompt-pool');
const { check } = require('./check-prompt-pool');

admin.initializeApp({ credential: admin.cert(require('../serviceAccountKey.json')) });
const db = getFirestore();

// 앱의 src/utils/date.ts와 동일한 KST 기준으로 날짜를 계산한다.
function dateStringOf(offsetDays) {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000);
  kst.setDate(kst.getDate() + offsetDays);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 같은 카테고리가 연달아 나오지 않도록 풀을 셔플한다.
// 시드값을 고정해 재실행 시에도 동일한 순서를 유지한다.
function shuffleDeterministic(items, seed) {
  const arr = [...items];
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite');
  const days = Number(args.find((a) => !a.startsWith('--')) || 400);

  // 규칙을 어긴 글감이 서버로 올라가면 되돌리기 번거로우므로 올리기 전에 막는다.
  const problems = check(PROMPT_POOL);
  if (problems.length > 0) {
    console.error('글감 풀 규칙 위반 — 시드를 중단한다:');
    problems.forEach((p) => console.error(' -', p));
    process.exit(1);
  }

  const pool = shuffleDeterministic(PROMPT_POOL, 20260812);
  if (days > pool.length) {
    console.warn(`주의: ${days}일치를 요청했지만 풀이 ${pool.length}개라 ${days - pool.length}일은 글감이 겹친다.`);
  }
  console.log(`글감 풀 ${pool.length}개, ${days}일치 시드${overwrite ? ' (기존 날짜 덮어쓰기)' : ''}`);

  const existing = new Set();
  const snap = await db.collection('prompts').get();
  snap.forEach((d) => existing.add(d.id));

  // 이미 누가 글을 쓴 날짜의 글감은 무슨 일이 있어도 바꾸지 않는다.
  const answered = new Set();
  if (overwrite) {
    const writings = await db.collection('writings').get();
    writings.forEach((d) => {
      const promptId = d.data().promptId;
      if (promptId) answered.add(promptId);
    });
    console.log(`이미 글이 달린 날짜 ${answered.size}개는 덮어쓰지 않는다.`);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (let i = 0; i < days; i++) {
    const date = dateStringOf(i);
    const id = date.replace(/-/g, '');
    const alreadyThere = existing.has(id);
    if (alreadyThere && (!overwrite || answered.has(id))) {
      skipped++;
      continue;
    }
    const prompt = pool[i % pool.length];
    batch.set(db.collection('prompts').doc(id), {
      id,
      date,
      title: prompt.title,
      category: prompt.category,
      createdAt: Date.now(),
    });
    if (alreadyThere) updated++;
    else created++;
    batchCount++;
    if (batchCount === 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();
  console.log(`완료: ${created}개 생성, ${updated}개 갱신, ${skipped}개 건너뜀(이미 존재)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
