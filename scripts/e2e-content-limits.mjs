// 글 본문(lines) 제한이 보안 규칙에서도 강제되는지 검증한다.
// 클라이언트 검증(validateLines)은 SDK를 직접 쓰면 우회되므로, 공개 피드에
// 거대한 본문이나 줄 수 초과 글이 올라가지 않는지 규칙 수준에서 확인하는 것이 목적이다.
//
// 사용법: node scripts/e2e-content-limits.mjs
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, addDoc, collection, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const config = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const pass = [], fail = [];
function check(name, ok, detail = '') {
  (ok ? pass : fail).push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const now = new Date();
const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000);
const promptId = `${kst.getFullYear()}${String(kst.getMonth() + 1).padStart(2, '0')}${String(kst.getDate()).padStart(2, '0')}`;

const app = initializeApp(config, 'contentlimits');
const auth = getAuth(app);
const db = getFirestore(app);
const stamp = Date.now();
const { user } = await createUserWithEmailAndPassword(auth, `e2e.lim.${stamp}@saegim-test.dev`, 'e2eTest1234!');
await setDoc(doc(db, 'users', user.uid), {
  uid: user.uid, nickname: `제한${stamp.toString().slice(-5)}`, photoURL: null, createdAt: Date.now(),
  writingCount: 0, publicPostCount: 0, streakCount: 0, bestStreak: 0,
  lastWritingDate: null, blockedUserIds: [], earnedBadgeIds: [],
});

const created = [];
async function tryPost(lines) {
  try {
    const ref = await addDoc(collection(db, 'posts'), {
      writingId: 'dummy', userId: user.uid, promptId, lines,
      createdAt: Date.now(), likeCount: 0, commentCount: 0,
    });
    created.push(ref);
    return true;
  } catch {
    return false;
  }
}

check('정상 3줄 허용', await tryPost(['첫 줄', '둘째 줄', '셋째 줄']));
check('1줄 허용', await tryPost(['한 줄이어도 충분해요']));
// 앱은 "3줄"을 권하지만 줄 수를 막지는 않아 왔다(총 글자 수로만 제한).
// 짧은 줄 여러 개로 쓰던 기존 사용자가 갑자기 막히면 안 되므로 허용해야 한다.
check('짧은 4줄 허용(기존 사용 방식)', await tryPost(['1', '2', '3', '4']));
check('10줄 허용(상한 경계)', await tryPost(['1','2','3','4','5','6','7','8','9','10']));
check('11줄 차단', !(await tryPost(['1','2','3','4','5','6','7','8','9','10','11'])));
check('빈 배열 차단', !(await tryPost([])));
check('초장문 한 줄 차단', !(await tryPost(['가'.repeat(5000)])));
check('문자열 아닌 값 차단', !(await tryPost([{ evil: true }])));
// 앞 몇 줄만 검사하고 마는 구현이면 뒤쪽 줄로 우회할 수 있다.
check('뒤쪽 줄의 초장문도 차단', !(await tryPost(['짧음', '짧음', '짧음', '짧음', '가'.repeat(5000)])));

// writings에도 같은 제한이 걸리는지(쿨다운 때문에 한 번만 시도).
try {
  const b = writeBatch(db);
  const wRef = doc(collection(db, 'writings'));
  b.set(wRef, { userId: user.uid, promptId, lines: ['가'.repeat(5000)], visibility: 'private', createdAt: Date.now(), postId: null });
  b.set(doc(db, 'rateLimits', user.uid, 'actions', 'writing'), { at: serverTimestamp() });
  await b.commit();
  check('writings 초장문 차단', false, '거대 본문이 저장됨(취약)');
  await deleteDoc(wRef).catch(() => {});
} catch {
  check('writings 초장문 차단', true);
}

for (const ref of created) await deleteDoc(ref).catch(() => {});
await deleteDoc(doc(db, 'users', user.uid)).catch(() => {});
await auth.currentUser?.delete().catch(() => {});
console.log(`\n=== 결과: ${pass.length} PASS / ${fail.length} FAIL ===`);
if (fail.length) fail.forEach((f) => console.log(' - ' + f));
await deleteApp(app);
process.exit(fail.length ? 1 : 0);
