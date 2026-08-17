// 도배 방지(쿨다운) 보안 규칙 검증.
// 실제 클라이언트 SDK + 실제 배포된 규칙으로, 정상 경로가 통과하고 우회 시도가 막히는지 확인한다.
// 사용법: node scripts/e2e-rate-limit.mjs
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import {
  getFirestore, doc, collection, addDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp,
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

// 규칙이 거절하면 permission-denied가 난다. "막혀야 하는" 케이스는 거절을 기대한다.
async function expectDenied(name, fn) {
  try {
    await fn();
    check(name, false, '차단되지 않고 통과함(취약)');
  } catch (e) {
    check(name, e.code === 'permission-denied', e.code ?? String(e));
  }
}

const now = new Date();
const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000);
const promptId = `${kst.getFullYear()}${String(kst.getMonth() + 1).padStart(2, '0')}${String(kst.getDate()).padStart(2, '0')}`;

function stampRateLimit(batch, db, uid, action) {
  batch.set(doc(db, 'rateLimits', uid, 'actions', action), { at: serverTimestamp() });
}

async function main() {
  const app = initializeApp(config, 'rateLimit');
  const auth = getAuth(app);
  const db = getFirestore(app);

  const cred = await createUserWithEmailAndPassword(
    auth,
    `e2e.rl.${Date.now()}@saegim-test.dev`,
    'e2eTest1234!'
  );
  const uid = cred.user.uid;
  check('테스트 계정 생성', !!uid);

  // ── 정상 경로 ────────────────────────────────────────────────
  const writingRef = doc(collection(db, 'writings'));
  {
    const batch = writeBatch(db);
    batch.set(writingRef, {
      userId: uid, promptId, lines: ['쿨다운 테스트'], createdAt: Date.now(),
      updatedAt: Date.now(), visibility: 'private', postId: null,
    });
    stampRateLimit(batch, db, uid, 'writing');
    await batch.commit();
  }
  check('글 작성 1회차 통과(쿨다운 기록 동봉)', true);

  const postRef = await addDoc(collection(db, 'posts'), {
    writingId: writingRef.id, userId: uid, promptId, lines: ['쿨다운 테스트'],
    createdAt: Date.now(), likeCount: 0, commentCount: 0,
  });

  const comment1 = doc(collection(db, 'comments'));
  {
    const batch = writeBatch(db);
    batch.set(comment1, {
      postId: postRef.id, userId: uid, authorNickname: 'RL테스터',
      content: '첫 댓글', createdAt: Date.now(),
    });
    batch.update(doc(db, 'posts', postRef.id), { commentCount: 1 });
    stampRateLimit(batch, db, uid, 'comment');
    await batch.commit();
  }
  check('댓글 1회차 통과', true);

  // ── 도배 차단 ────────────────────────────────────────────────
  await expectDenied('댓글 연속 작성 차단(15초 쿨다운)', async () => {
    const batch = writeBatch(db);
    const ref = doc(collection(db, 'comments'));
    batch.set(ref, {
      postId: postRef.id, userId: uid, authorNickname: 'RL테스터',
      content: '도배 댓글', createdAt: Date.now(),
    });
    stampRateLimit(batch, db, uid, 'comment');
    await batch.commit();
  });

  await expectDenied('글 연속 작성 차단(60초 쿨다운)', async () => {
    const batch = writeBatch(db);
    const ref = doc(collection(db, 'writings'));
    batch.set(ref, {
      userId: uid, promptId, lines: ['도배 글'], createdAt: Date.now(),
      updatedAt: Date.now(), visibility: 'private', postId: null,
    });
    stampRateLimit(batch, db, uid, 'writing');
    await batch.commit();
  });

  // ── 우회 시도 차단 ───────────────────────────────────────────
  // 쿨다운 문서를 갱신하지 않고 그냥 쓰면 getAfter 검사에서 걸린다.
  await expectDenied('쿨다운 기록 없이 댓글 작성 차단', async () => {
    await addDoc(collection(db, 'comments'), {
      postId: postRef.id, userId: uid, authorNickname: 'RL테스터',
      content: '기록 없는 댓글', createdAt: Date.now(),
    });
  });

  // 과거 시각을 직접 써서 쿨다운을 우회하려는 시도.
  await expectDenied('쿨다운 시각 위조 차단(과거 timestamp)', async () => {
    await writeBatch(db)
      .set(doc(db, 'rateLimits', uid, 'actions', 'comment'), {
        at: Timestamp.fromMillis(Date.now() - 60 * 60 * 1000),
      })
      .commit();
  });

  // 쿨다운 문서를 지워서 초기화하려는 시도.
  await expectDenied('쿨다운 기록 삭제 차단', async () => {
    await deleteDoc(doc(db, 'rateLimits', uid, 'actions', 'comment'));
  });

  // ── 정리 ─────────────────────────────────────────────────────
  await deleteDoc(comment1).catch(() => {});
  await deleteDoc(doc(db, 'posts', postRef.id)).catch(() => {});
  await deleteDoc(writingRef).catch(() => {});
  await deleteUser(cred.user).catch(() => {});
  // rateLimits/{uid}/actions/* 는 규칙상 클라이언트가 지울 수 없어 남는다(문서당 수십 바이트).
  await deleteApp(app);

  console.log(`\n통과 ${pass.length} / 실패 ${fail.length}`);
  if (fail.length) {
    console.log('실패 목록:');
    fail.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
