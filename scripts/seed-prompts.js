// DailyPrompt 시드 스크립트. 오늘부터 N일치 글감을 채운다.
// 이미 존재하는 날짜는 건드리지 않아 여러 번 실행해도 안전하다.
// 사용법: node scripts/seed-prompts.js [days]
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { PROMPT_POOL } = require('./prompt-pool');

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
  const days = Number(process.argv[2] || 400);
  const pool = shuffleDeterministic(PROMPT_POOL, 20260812);
  console.log(`글감 풀 ${pool.length}개, ${days}일치 시드 (풀 소진 후 순환)`);

  const existing = new Set();
  const snap = await db.collection('prompts').get();
  snap.forEach((d) => existing.add(d.id));

  let created = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (let i = 0; i < days; i++) {
    const date = dateStringOf(i);
    const id = date.replace(/-/g, '');
    if (existing.has(id)) {
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
    created++;
    batchCount++;
    if (batchCount === 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();
  console.log(`완료: ${created}개 생성, ${skipped}개 건너뜀(이미 존재)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
