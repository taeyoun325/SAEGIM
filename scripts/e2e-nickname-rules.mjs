// 닉네임 규칙이 서버(보안 규칙)에서도 강제되는지 검증한다.
// 클라이언트 검증(utils/nickname.ts)은 Firebase SDK를 직접 쓰면 우회되므로,
// "관리자" 같은 사칭 닉네임이 규칙 수준에서 막히는지 확인하는 것이 목적이다.
//
// 사용법: node scripts/e2e-nickname-rules.mjs
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';

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

const app = initializeApp(config, 'nickrules');
const auth = getAuth(app);
const db = getFirestore(app);
const stamp = Date.now();
const { user } = await createUserWithEmailAndPassword(auth, `e2e.nick.${stamp}@saegim-test.dev`, 'e2eTest1234!');

async function tryNickname(nick) {
  try {
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid, nickname: nick, photoURL: null, createdAt: Date.now(),
      writingCount: 0, publicPostCount: 0, streakCount: 0, bestStreak: 0,
      lastWritingDate: null, blockedUserIds: [], earnedBadgeIds: [],
    });
    return true;
  } catch {
    return false;
  }
}

// 정상 닉네임은 통과해야 한다. 특히 한글은 규칙의 size()가 바이트가 아니라
// 글자 수로 세는지 확인하는 의미가 있다(바이트면 5글자 한글이 15로 잡혀 막힌다).
check('한글 3자 허용', await tryNickname('하루한'));
check('한글 5자 허용(size가 글자 수인지 확인)', await tryNickname('오늘도맑음'));
check('영문+숫자 허용', await tryNickname('daily_user1'));
check('한글 12자 허용(상한 경계)', await tryNickname('가나다라마바사아자차카타'));

// 사칭·형식 위반은 막혀야 한다.
check('"관리자" 차단', !(await tryNickname('관리자')));
check('"운영자" 포함 차단', !(await tryNickname('새김운영자')));
check('"admin" 차단(대소문자 무시)', !(await tryNickname('AdMin123')));
check('"새김" 포함 차단', !(await tryNickname('새김지기')));
check('1자 차단', !(await tryNickname('가')));
check('13자 차단', !(await tryNickname('가나다라마바사아자차카타파')));
check('특수문자 차단', !(await tryNickname('hello@world')));

// 닉네임 예약 문서도 같은 규칙을 받는지 확인.
try {
  await setDoc(doc(db, 'nicknames', `관리자${stamp}`), { uid: user.uid, nickname: '관리자', createdAt: Date.now() });
  check('닉네임 예약에도 규칙 적용', false, '"관리자" 예약이 통과함(취약)');
  await deleteDoc(doc(db, 'nicknames', `관리자${stamp}`)).catch(() => {});
} catch {
  check('닉네임 예약에도 규칙 적용', true);
}

await deleteDoc(doc(db, 'users', user.uid)).catch(() => {});
await auth.currentUser?.delete().catch(() => {});
console.log(`\n=== 결과: ${pass.length} PASS / ${fail.length} FAIL ===`);
if (fail.length) fail.forEach((f) => console.log(' - ' + f));
await deleteApp(app);
process.exit(fail.length ? 1 : 0);
