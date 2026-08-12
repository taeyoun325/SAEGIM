// 관리자 권한 통합 테스트.
// 일반 사용자는 신고를 볼 수 없고, 관리자만 조회/처리할 수 있는지 실제 보안 규칙으로 검증한다.
// 사용법: node scripts/e2e-admin.mjs
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, addDoc, collection, deleteDoc,
  query, where, orderBy, limit, getDocs, updateDoc,
} from 'firebase/firestore';
import admin from 'firebase-admin';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';

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

const serviceAccount = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'));
admin.initializeApp({ credential: admin.cert(serviceAccount) });
const adb = adminFirestore();

const pass = [];
const fail = [];
function check(name, ok, detail = '') {
  (ok ? pass : fail).push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const now = new Date();
const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000);
const promptId = `${kst.getFullYear()}${String(kst.getMonth() + 1).padStart(2, '0')}${String(kst.getDate()).padStart(2, '0')}`;

async function main() {
  const stamp = Date.now();
  const password = 'e2eAdmin1234!';

  const N = initializeApp(config, 'normalUser');   // 일반 사용자
  const A = initializeApp(config, 'adminUser');    // 관리자
  const nAuth = getAuth(N), nDb = getFirestore(N);
  const aAuth = getAuth(A), aDb = getFirestore(A);

  const nCred = await createUserWithEmailAndPassword(nAuth, `e2e.normal.${stamp}@saegim-test.dev`, password);
  const aCred = await createUserWithEmailAndPassword(aAuth, `e2e.admin.${stamp}@saegim-test.dev`, password);
  const nUid = nCred.user.uid, aUid = aCred.user.uid;
  check('테스트 계정 2개 생성', !!nUid && !!aUid);

  for (const [db, uid, nick] of [[nDb, nUid, `일반${stamp}`], [aDb, aUid, `관리자${stamp}`]]) {
    await setDoc(doc(db, 'users', uid), {
      uid, nickname: nick, photoURL: null, createdAt: Date.now(),
      writingCount: 0, publicPostCount: 0, streakCount: 0, lastWritingDate: null, blockedUserIds: [],
    });
  }

  // --- 일반 사용자가 게시물 작성 (신고 대상) ---
  const wRef = await addDoc(collection(nDb, 'writings'), {
    userId: nUid, promptId, lines: ['신고 대상 테스트 글'], createdAt: Date.now(),
    updatedAt: Date.now(), visibility: 'private', postId: null,
  });
  const postRef = await addDoc(collection(nDb, 'posts'), {
    writingId: wRef.id, userId: nUid, promptId, lines: ['신고 대상 테스트 글'],
    createdAt: Date.now(), likeCount: 0, commentCount: 0,
  });
  check('신고 대상 게시물 생성', !!postRef.id);

  // --- 관리자가 신고 접수 ---
  const reportRef = await addDoc(collection(aDb, 'reports'), {
    targetType: 'post', targetId: postRef.id, reporterId: aUid,
    reason: 'spam', detail: 'e2e admin test', createdAt: Date.now(), status: 'pending',
  });
  check('신고 접수', !!reportRef.id);

  // --- 아직 관리자가 아니므로 신고 조회 불가 ---
  try {
    await getDocs(query(collection(aDb, 'reports'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(5)));
    check('관리자 지정 전 신고 조회 차단', false, '조회가 허용됨(취약)');
  } catch {
    check('관리자 지정 전 신고 조회 차단', true);
  }

  // --- 클라이언트가 스스로 관리자로 승격 시도 (반드시 차단돼야 함) ---
  try {
    await setDoc(doc(aDb, 'admins', aUid), { uid: aUid, email: 'hack', createdAt: Date.now() });
    check('클라이언트 자체 관리자 승격 차단', false, '승격 성공(심각한 취약)');
  } catch {
    check('클라이언트 자체 관리자 승격 차단', true);
  }

  // --- Admin SDK로 관리자 지정 (set-admin.js와 동일한 방식) ---
  await adb.collection('admins').doc(aUid).set({ uid: aUid, email: aCred.user.email, createdAt: Date.now() });
  check('Admin SDK로 관리자 지정', true);

  // --- 관리자는 본인 admin 문서를 읽어 권한 확인 가능 ---
  const adminDoc = await getDoc(doc(aDb, 'admins', aUid));
  check('관리자 본인 권한 확인 가능', adminDoc.exists());

  // --- 일반 사용자는 타인의 admin 문서를 볼 수 없음 ---
  try {
    await getDoc(doc(nDb, 'admins', aUid));
    check('타인 관리자 문서 조회 차단', false, '조회 허용됨(취약)');
  } catch {
    check('타인 관리자 문서 조회 차단', true);
  }

  // --- 이제 관리자는 신고 목록 조회 가능 ---
  const reportsSnap = await getDocs(
    query(collection(aDb, 'reports'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(20))
  );
  check('관리자 신고 목록 조회', reportsSnap.docs.some((d) => d.id === reportRef.id), `${reportsSnap.size}건 조회`);

  // --- 일반 사용자는 여전히 신고 조회 불가 ---
  try {
    await getDocs(query(collection(nDb, 'reports'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(5)));
    check('일반 사용자 신고 조회 차단', false, '조회가 허용됨(취약)');
  } catch {
    check('일반 사용자 신고 조회 차단', true);
  }

  // --- 일반 사용자는 타인 게시물 삭제 불가 ---
  const otherPost = await addDoc(collection(aDb, 'posts'), {
    writingId: 'x', userId: aUid, promptId, lines: ['관리자 글'],
    createdAt: Date.now(), likeCount: 0, commentCount: 0,
  });
  try {
    await deleteDoc(doc(nDb, 'posts', otherPost.id));
    check('일반 사용자 타인 게시물 삭제 차단', false, '삭제됨(취약)');
  } catch {
    check('일반 사용자 타인 게시물 삭제 차단', true);
  }

  // --- 관리자는 신고된 타인 게시물 삭제 가능 ---
  await deleteDoc(doc(aDb, 'posts', postRef.id));
  const deleted = await getDoc(doc(aDb, 'posts', postRef.id));
  check('관리자 신고 게시물 삭제', !deleted.exists());

  // --- 관리자는 신고 상태를 reviewed로 변경 가능 ---
  await updateDoc(doc(aDb, 'reports', reportRef.id), { status: 'reviewed' });
  const reviewed = await getDoc(doc(aDb, 'reports', reportRef.id));
  check('관리자 신고 처리 상태 변경', reviewed.data().status === 'reviewed');

  // --- 관리자도 신고 내용 자체는 변조 불가 ---
  try {
    await updateDoc(doc(aDb, 'reports', reportRef.id), { reason: 'other', targetId: 'forged' });
    check('신고 내용 변조 차단', false, '변조됨(취약)');
  } catch {
    check('신고 내용 변조 차단', true);
  }

  // --- 정리 ---
  await deleteDoc(doc(aDb, 'posts', otherPost.id)).catch(() => {});
  await deleteDoc(doc(nDb, 'writings', wRef.id)).catch(() => {});
  await adb.collection('reports').doc(reportRef.id).delete().catch(() => {});
  await adb.collection('admins').doc(aUid).delete().catch(() => {});
  await deleteDoc(doc(nDb, 'users', nUid)).catch(() => {});
  await deleteDoc(doc(aDb, 'users', aUid)).catch(() => {});
  await nAuth.currentUser?.delete().catch(() => {});
  await aAuth.currentUser?.delete().catch(() => {});
  check('테스트 데이터 정리', true);

  console.log(`\n=== 결과: ${pass.length} PASS / ${fail.length} FAIL ===`);
  if (fail.length) {
    console.log('\n실패 항목:');
    fail.forEach((f) => console.log(' - ' + f));
  }
  await deleteApp(N);
  await deleteApp(A);
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error('\n치명적 오류:', e);
  process.exit(1);
});
