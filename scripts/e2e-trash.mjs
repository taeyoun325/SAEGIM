// 휴지통(비공개 글 삭제) 회귀 테스트.
//
// 비공개 글은 지워도 곧장 사라지지 않고 휴지통에 30일간 보관된다(softDeleteWriting).
// 그런데 휴지통에는 "복구"만 있고 즉시 지우는 길이 없어서, 지우려고 지운 글을 30일
// 동안 계속 마주쳐야 했다. 이 스크립트는 그 즉시 삭제 경로가 실제 보안 규칙 아래서
// 동작하는지, 그리고 남의 글까지 지워지지는 않는지 확인한다.
//
// 사용법: node scripts/e2e-trash.mjs
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, collection, deleteDoc,
  query, where, getDocs, writeBatch, serverTimestamp, updateDoc,
} from 'firebase/firestore';

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

const pass = [];
const fail = [];
function check(name, ok, detail = '') {
  (ok ? pass : fail).push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const now = new Date();
const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000);
const promptId = `${kst.getFullYear()}${String(kst.getMonth() + 1).padStart(2, '0')}${String(kst.getDate()).padStart(2, '0')}`;

async function session(label) {
  const app = initializeApp(config, label);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}

// 앱의 writingService.createWriting과 같은 방식(쿨다운 기록을 같은 배치에 넣는다).
async function createWriting(db, uid, lines) {
  const ref = doc(collection(db, 'writings'));
  const batch = writeBatch(db);
  batch.set(ref, {
    userId: uid, promptId, lines, createdAt: Date.now(), updatedAt: Date.now(),
    visibility: 'private', postId: null,
  });
  batch.set(doc(db, 'rateLimits', uid, 'actions', 'writing'), { at: serverTimestamp() });
  await batch.commit();
  return ref;
}

async function main() {
  const A = await session('trashA'); // 글 주인
  const B = await session('trashB'); // 남의 글을 지우려 시도하는 사람
  const stamp = Date.now();
  const nick = stamp.toString().slice(-5);
  const password = 'e2eTest1234!';

  const a = await createUserWithEmailAndPassword(A.auth, `trash.a.${stamp}@saegim-e2e.local`, password);
  const b = await createUserWithEmailAndPassword(B.auth, `trash.b.${stamp}@saegim-e2e.local`, password);
  await setDoc(doc(A.db, 'nicknames', `ta${nick}`), { uid: a.user.uid, nickname: `ta${nick}`, createdAt: Date.now() });
  await setDoc(doc(A.db, 'users', a.user.uid), {
    uid: a.user.uid, nickname: `ta${nick}`, photoURL: null, createdAt: Date.now(),
    writingCount: 0, publicPostCount: 0, streakCount: 0, lastWritingDate: null,
    blockedUserIds: [], earnedBadgeIds: [], bio: null, bestStreak: 0, streakFreezes: 0,
  });
  await setDoc(doc(B.db, 'nicknames', `tb${nick}`), { uid: b.user.uid, nickname: `tb${nick}`, createdAt: Date.now() });
  await setDoc(doc(B.db, 'users', b.user.uid), {
    uid: b.user.uid, nickname: `tb${nick}`, photoURL: null, createdAt: Date.now(),
    writingCount: 0, publicPostCount: 0, streakCount: 0, lastWritingDate: null,
    blockedUserIds: [], earnedBadgeIds: [], bio: null, bestStreak: 0, streakFreezes: 0,
  });
  check('테스트 계정 생성', true);

  // 1) 비공개 글 작성 → 휴지통으로 보내기(소프트 삭제)
  const w1 = await createWriting(A.db, a.user.uid, ['휴지통 테스트 한 줄']);
  await updateDoc(w1, { deletedAt: Date.now() });
  const afterSoft = await getDoc(w1);
  check('소프트 삭제 후에도 문서는 남아있다(복구 가능)', afterSoft.exists() && !!afterSoft.data().deletedAt);

  // 2) 휴지통 목록 조회 시 deletedAt 있는 글만 잡힌다
  const mine = await getDocs(query(collection(A.db, 'writings'), where('userId', '==', a.user.uid)));
  const trashed = mine.docs.filter((d) => d.data().deletedAt);
  check('휴지통 목록에 잡힌다', trashed.length === 1 && trashed[0].id === w1.id);

  // 3) 남은 이 글을 지울 수 없어야 한다
  let blocked = false;
  try {
    await deleteDoc(doc(B.db, 'writings', w1.id));
  } catch (e) {
    blocked = e?.code === 'permission-denied';
  }
  check('남의 휴지통 글은 지울 수 없다', blocked);

  // 4) 주인은 보관 기한을 기다리지 않고 바로 지울 수 있다 (deleteTrashedWriting)
  //
  // ⚠️ 지운 뒤 getDoc으로 확인하면 안 된다. 읽기 규칙이 resource.data.userId를 보는데
  //    문서가 없으면 resource가 null이라 permission-denied가 나고, 삭제는 성공했는데
  //    검증에서 실패한 것처럼 보인다. 목록 쿼리로 사라졌는지 확인한다.
  let hardDeleteError = null;
  try {
    await deleteDoc(doc(A.db, 'writings', w1.id));
  } catch (e) {
    hardDeleteError = e;
  }
  const afterHard = await getDocs(query(collection(A.db, 'writings'), where('userId', '==', a.user.uid)));
  check(
    '주인은 휴지통 글을 즉시 완전 삭제할 수 있다',
    hardDeleteError === null && afterHard.docs.every((d) => d.id !== w1.id),
    hardDeleteError ? String(hardDeleteError.code || hardDeleteError) : ''
  );

  // 5) 휴지통 비우기가 "내 글만" 지우는지 확인한다.
  //    B도 비공개 글 하나를 휴지통에 넣어두고, A가 휴지통을 비운 뒤에도 B의 글이
  //    그대로 남아있어야 한다(emptyTrash가 userId로 자기 글만 훑는지 검증).
  const wB = await createWriting(B.db, b.user.uid, ['B의 휴지통 글']);
  await updateDoc(wB, { deletedAt: Date.now() });

  const aTrash = await getDocs(query(collection(A.db, 'writings'), where('userId', '==', a.user.uid)));
  let emptyError = null;
  try {
    for (const d of aTrash.docs.filter((d) => d.data().deletedAt)) await deleteDoc(d.ref);
  } catch (e) {
    emptyError = e;
  }
  check('휴지통 비우기 성공', emptyError === null, emptyError ? String(emptyError.code || emptyError) : '');

  const bTrash = await getDocs(query(collection(B.db, 'writings'), where('userId', '==', b.user.uid)));
  check('남의 휴지통은 그대로 남는다', bTrash.docs.some((d) => d.id === wB.id));

  // 정리
  const leftoverA = await getDocs(query(collection(A.db, 'writings'), where('userId', '==', a.user.uid)));
  for (const d of leftoverA.docs) await deleteDoc(d.ref).catch(() => {});
  for (const d of bTrash.docs) await deleteDoc(d.ref).catch(() => {});
  await deleteDoc(doc(A.db, 'users', a.user.uid)).catch(() => {});
  await deleteDoc(doc(B.db, 'users', b.user.uid)).catch(() => {});
  await deleteDoc(doc(A.db, 'nicknames', `ta${nick}`)).catch(() => {});
  await deleteDoc(doc(B.db, 'nicknames', `tb${nick}`)).catch(() => {});
  await A.auth.currentUser?.delete().catch(() => {});
  await B.auth.currentUser?.delete().catch(() => {});

  console.log(`\n=== 결과: ${pass.length} PASS / ${fail.length} FAIL ===`);
  if (fail.length) {
    console.log('실패 항목:');
    fail.forEach((f) => console.log(' -', f));
  }
  await deleteApp(A.app);
  await deleteApp(B.app);
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error('치명적 오류:', e);
  process.exit(1);
});
