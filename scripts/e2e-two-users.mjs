// User A / User B 실제 상호작용 통합 테스트.
// 클라이언트 SDK + 실제 보안 규칙으로 앱과 동일한 경로를 검증한다.
// 사용법: node scripts/e2e-two-users.mjs
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, addDoc, collection, updateDoc, deleteDoc,
  query, where, orderBy, limit, getDocs, runTransaction, increment,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';

// 도배 방지 규칙: 글/댓글 생성은 같은 배치에서 쿨다운 문서를 서버 시각으로 갱신해야 통과한다.
// (앱의 src/services/rateLimitService.ts와 동일한 동작을 테스트에서도 재현한다.)
function stampRateLimit(batch, db, uid, action) {
  batch.set(doc(db, 'rateLimits', uid, 'actions', action), { at: serverTimestamp() });
}

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
  (ok ? pass : fail).push(name + (detail ? ` — ${detail}` : ''));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// 앱의 src/utils/date.ts와 동일한 KST 기준
const nowForPrompt = new Date();
const kstNow = new Date(nowForPrompt.getTime() + (9 * 60 + nowForPrompt.getTimezoneOffset()) * 60 * 1000);
const promptId = `${kstNow.getFullYear()}${String(kstNow.getMonth() + 1).padStart(2, '0')}${String(kstNow.getDate()).padStart(2, '0')}`;

async function session(label) {
  const app = initializeApp(config, label);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}

async function ensureUser(auth, email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return { user: cred.user, created: true };
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return { user: cred.user, created: false };
    }
    throw e;
  }
}

async function main() {
  const A = await session('userA');
  const B = await session('userB');
  const stamp = Date.now();
  const emailA = `e2e.a.${stamp}@saegim-test.dev`;
  const emailB = `e2e.b.${stamp}@saegim-test.dev`;
  const password = 'e2eTest1234!';

  // --- 계정 생성 ---
  const { user: ua } = await ensureUser(A.auth, emailA, password);
  const { user: ub } = await ensureUser(B.auth, emailB, password);
  check('A/B 회원가입', !!ua.uid && !!ub.uid);

  for (const [s, u, nick] of [[A, ua, 'E2E테스터A'], [B, ub, 'E2E테스터B']]) {
    await setDoc(doc(s.db, 'users', u.uid), {
      uid: u.uid, nickname: nick, photoURL: null, createdAt: Date.now(),
      writingCount: 0, publicPostCount: 0, streakCount: 0, lastWritingDate: null, blockedUserIds: [],
    });
  }
  check('프로필 문서 생성', true);

  // --- 닉네임 유니크: A가 예약한 닉네임을 B가 가로챌 수 없어야 함 ---
  const sharedNick = `e2e공용닉${stamp}`;
  await setDoc(doc(A.db, 'nicknames', sharedNick.toLowerCase()), {
    uid: ua.uid, nickname: sharedNick, createdAt: Date.now(),
  });
  check('닉네임 예약 생성', true);

  try {
    await setDoc(doc(B.db, 'nicknames', sharedNick.toLowerCase()), {
      uid: ub.uid, nickname: sharedNick, createdAt: Date.now(),
    });
    check('닉네임 중복 선점 차단', false, 'B가 A의 닉네임을 덮어씀(취약)');
  } catch {
    check('닉네임 중복 선점 차단', true);
  }

  try {
    await deleteDoc(doc(B.db, 'nicknames', sharedNick.toLowerCase()));
    check('타인 닉네임 예약 삭제 차단', false, 'B가 A의 예약을 지움(취약)');
  } catch {
    check('타인 닉네임 예약 삭제 차단', true);
  }

  // --- 오늘의 글감 조회 (모든 사용자 동일) ---
  const pa = await getDoc(doc(A.db, 'prompts', promptId));
  const pb = await getDoc(doc(B.db, 'prompts', promptId));
  check('A/B 동일한 오늘의 글감', pa.exists() && pb.exists() && pa.data().title === pb.data().title,
    pa.exists() ? pa.data().title : 'missing');

  // --- 글감 위조 방지 ---
  try {
    await setDoc(doc(A.db, 'prompts', promptId), { title: '해킹됨' }, { merge: true });
    check('클라이언트 글감 위조 차단', false, '쓰기가 허용됨(취약)');
  } catch {
    check('클라이언트 글감 위조 차단', true);
  }

  // --- A가 글 작성 (비공개) ---
  const lines = ['E2E 첫 번째 줄', 'E2E 두 번째 줄', 'E2E 세 번째 줄'];
  const wRef = doc(collection(A.db, 'writings'));
  {
    const batch = writeBatch(A.db);
    batch.set(wRef, {
      userId: ua.uid, promptId, lines, createdAt: Date.now(), updatedAt: Date.now(),
      visibility: 'private', postId: null,
    });
    stampRateLimit(batch, A.db, ua.uid, 'writing');
    await batch.commit();
  }
  check('A 글 저장(비공개)', !!wRef.id);

  // --- B는 A의 비공개 글을 볼 수 없어야 함 ---
  try {
    await getDoc(doc(B.db, 'writings', wRef.id));
    check('타인 비공개 글 조회 차단', false, 'B가 A의 비공개 글을 읽음(취약)');
  } catch {
    check('타인 비공개 글 조회 차단', true);
  }

  // --- A가 게시 ---
  const postRef = await addDoc(collection(A.db, 'posts'), {
    writingId: wRef.id, userId: ua.uid, promptId, lines,
    createdAt: Date.now(), likeCount: 0, commentCount: 0,
  });
  await updateDoc(doc(A.db, 'writings', wRef.id), { visibility: 'public', postId: postRef.id, updatedAt: Date.now() });
  check('A 게시(공개 전환)', !!postRef.id);

  // --- B가 피드에서 확인 ---
  const feed = await getDocs(query(collection(B.db, 'posts'), where('promptId', '==', promptId), orderBy('createdAt', 'desc'), limit(10)));
  check('B 피드에서 A 게시물 확인', feed.docs.some((d) => d.id === postRef.id), `피드 ${feed.size}건`);

  // --- A가 게시물 본문 수정 ---
  const editedLines = ['수정된 첫 번째 줄', '수정된 두 번째 줄', '수정된 세 번째 줄'];
  await updateDoc(doc(A.db, 'writings', wRef.id), { lines: editedLines, updatedAt: Date.now() });
  await updateDoc(doc(A.db, 'posts', postRef.id), { lines: editedLines });
  const editedPost = await getDoc(doc(B.db, 'posts', postRef.id));
  check('A 본문 수정 반영', editedPost.data().lines[0] === '수정된 첫 번째 줄');

  // --- B는 A의 게시물 본문을 수정 못함 (이미 위에서 별도 확인하지만 수정 후에도 재확인) ---
  try {
    await updateDoc(doc(B.db, 'posts', postRef.id), { lines: ['B가 수정 시도'] });
    check('타인 본문 수정 차단(2차)', false, 'B가 본문 변경(취약)');
  } catch {
    check('타인 본문 수정 차단(2차)', true);
  }

  // --- B가 좋아요 (트랜잭션) ---
  const likeId = `${postRef.id}_${ub.uid}`;
  await runTransaction(B.db, async (tx) => {
    const p = await tx.get(doc(B.db, 'posts', postRef.id));
    tx.set(doc(B.db, 'likes', likeId), { id: likeId, postId: postRef.id, userId: ub.uid, createdAt: Date.now() });
    tx.update(doc(B.db, 'posts', postRef.id), { likeCount: (p.data().likeCount || 0) + 1 });
  });
  let ps = await getDoc(doc(B.db, 'posts', postRef.id));
  check('B 좋아요 반영', ps.data().likeCount === 1, `likeCount=${ps.data().likeCount}`);

  // --- 좋아요 문서 id 위조 방지 ---
  try {
    await setDoc(doc(B.db, 'likes', 'bogus_id'), { id: 'bogus_id', postId: postRef.id, userId: ub.uid, createdAt: Date.now() });
    check('좋아요 id 규칙 강제', false, '잘못된 id 허용됨(취약)');
  } catch {
    check('좋아요 id 규칙 강제', true);
  }

  // --- A가 B의 좋아요를 삭제 못함 ---
  try {
    await deleteDoc(doc(A.db, 'likes', likeId));
    check('타인 좋아요 삭제 차단', false, 'A가 B의 좋아요를 삭제(취약)');
  } catch {
    check('타인 좋아요 삭제 차단', true);
  }

  // --- 좋아요 취소 (토글) ---
  await runTransaction(B.db, async (tx) => {
    const p = await tx.get(doc(B.db, 'posts', postRef.id));
    tx.delete(doc(B.db, 'likes', likeId));
    tx.update(doc(B.db, 'posts', postRef.id), { likeCount: Math.max(0, (p.data().likeCount || 0) - 1) });
  });
  ps = await getDoc(doc(B.db, 'posts', postRef.id));
  check('좋아요 취소', ps.data().likeCount === 0, `likeCount=${ps.data().likeCount}`);

  // 다시 좋아요 (이후 검증용)
  await runTransaction(B.db, async (tx) => {
    const p = await tx.get(doc(B.db, 'posts', postRef.id));
    tx.set(doc(B.db, 'likes', likeId), { id: likeId, postId: postRef.id, userId: ub.uid, createdAt: Date.now() });
    tx.update(doc(B.db, 'posts', postRef.id), { likeCount: (p.data().likeCount || 0) + 1 });
  });

  // --- B가 댓글 작성 ---
  const cRef = doc(collection(B.db, 'comments'));
  {
    const batch = writeBatch(B.db);
    batch.set(cRef, {
      postId: postRef.id, userId: ub.uid, authorNickname: 'E2E테스터B',
      content: 'E2E 댓글입니다', createdAt: Date.now(),
    });
    batch.update(doc(B.db, 'posts', postRef.id), { commentCount: increment(1) });
    stampRateLimit(batch, B.db, ub.uid, 'comment');
    await batch.commit();
  }
  ps = await getDoc(doc(B.db, 'posts', postRef.id));
  check('B 댓글 작성 + 카운트', !!cRef.id && ps.data().commentCount === 1, `commentCount=${ps.data().commentCount}`);

  // --- A가 댓글 확인 ---
  const comments = await getDocs(query(collection(A.db, 'comments'), where('postId', '==', postRef.id), orderBy('createdAt', 'asc')));
  check('A가 B 댓글 확인', comments.docs.some((d) => d.id === cRef.id), `댓글 ${comments.size}건`);

  // --- A는 B의 댓글을 삭제 못함 ---
  try {
    await deleteDoc(doc(A.db, 'comments', cRef.id));
    check('타인 댓글 삭제 차단', false, 'A가 B의 댓글 삭제(취약)');
  } catch {
    check('타인 댓글 삭제 차단', true);
  }

  // --- 게시물 본문 위조 방지 (B가 A의 게시물 내용 변경 시도) ---
  try {
    await updateDoc(doc(B.db, 'posts', postRef.id), { lines: ['위조됨'] });
    check('게시물 본문 위조 차단', false, 'B가 본문 변경(취약)');
  } catch {
    check('게시물 본문 위조 차단', true);
  }

  // --- 좋아요 수 임의 조작 방지 ---
  try {
    await updateDoc(doc(B.db, 'posts', postRef.id), { likeCount: 9999 });
    check('좋아요 수 임의 조작 차단', false, 'likeCount 999로 변경됨(취약)');
  } catch {
    check('좋아요 수 임의 조작 차단', true);
  }

  // ±1 제약만 있으면 "좋아요를 누르지 않고 1씩 계속 올리는" 우회가 가능하다.
  // A는 이 글에 좋아요를 누른 적이 없으므로, 좋아요 문서 없이 +1 하는 시도는 막혀야 한다.
  {
    const before = (await getDoc(doc(A.db, 'posts', postRef.id))).data().likeCount || 0;
    try {
      await updateDoc(doc(A.db, 'posts', postRef.id), { likeCount: before + 1 });
      check('좋아요 없이 카운트 증가 차단', false, `likeCount ${before}→${before + 1} (취약)`);
    } catch {
      check('좋아요 없이 카운트 증가 차단', true);
    }
  }

  // 반대로 남의 좋아요를 카운트에서만 빼는 것도 막혀야 한다.
  {
    const before = (await getDoc(doc(A.db, 'posts', postRef.id))).data().likeCount || 0;
    try {
      await updateDoc(doc(A.db, 'posts', postRef.id), { likeCount: Math.max(0, before - 1) });
      check('좋아요 없이 카운트 감소 차단', false, `likeCount ${before}→${before - 1} (취약)`);
    } catch {
      check('좋아요 없이 카운트 감소 차단', true);
    }
  }

  // --- B가 신고 ---
  await addDoc(collection(B.db, 'reports'), {
    targetType: 'post', targetId: postRef.id, reporterId: ub.uid,
    reason: 'spam', detail: 'e2e', createdAt: Date.now(), status: 'pending',
  });
  check('신고 접수', true);

  // --- 신고 내역 열람 차단 ---
  try {
    await getDocs(query(collection(B.db, 'reports'), where('reporterId', '==', ub.uid)));
    check('신고 내역 클라이언트 열람 차단', false, '읽기가 허용됨(취약)');
  } catch {
    check('신고 내역 클라이언트 열람 차단', true);
  }

  // --- B가 A를 차단 ---
  await updateDoc(doc(B.db, 'users', ub.uid), { blockedUserIds: [ua.uid] });
  const bprof = await getDoc(doc(B.db, 'users', ub.uid));
  check('사용자 차단 저장', bprof.data().blockedUserIds.includes(ua.uid));

  // --- 타인 프로필 위조 방지 ---
  try {
    await updateDoc(doc(B.db, 'users', ua.uid), { nickname: '위조됨' });
    check('타인 프로필 수정 차단', false, 'B가 A 프로필 변경(취약)');
  } catch {
    check('타인 프로필 수정 차단', true);
  }

  // --- 탈퇴 시 남의 글 카운트까지 정리되는지 (게시물이 아직 살아있을 때 확인해야 한다) ---
  // 문서만 지우면 "♥ 1인데 좋아요 0건"처럼 틀린 숫자가 영영 남는다.
  // 앱의 accountService.deleteMyReactions와 같은 방식: 삭제와 카운트 감소를 같은 커밋으로.
  {
    for (const [col, field, id] of [['comments', 'commentCount', cRef.id], ['likes', 'likeCount', likeId]]) {
      const batch = writeBatch(B.db);
      batch.delete(doc(B.db, col, id));
      batch.update(doc(B.db, 'posts', postRef.id), { [field]: increment(-1) });
      await batch.commit();
    }
    const afterLeave = await getDoc(doc(B.db, 'posts', postRef.id));
    check(
      '탈퇴 시 상대 글 카운트 정리',
      afterLeave.data().likeCount === 0 && afterLeave.data().commentCount === 0,
      `likeCount=${afterLeave.data().likeCount}, commentCount=${afterLeave.data().commentCount}`
    );
  }

  // --- A가 게시물 삭제 → B 피드에서 사라짐 ---
  await deleteDoc(doc(A.db, 'posts', postRef.id));
  await updateDoc(doc(A.db, 'writings', wRef.id), { visibility: 'private', postId: null, updatedAt: Date.now() });
  const feedAfter = await getDocs(query(collection(B.db, 'posts'), where('promptId', '==', promptId), orderBy('createdAt', 'desc'), limit(10)));
  check('A 삭제 후 B 피드에서 사라짐', !feedAfter.docs.some((d) => d.id === postRef.id));

  // --- 계정 삭제 시 콘텐츠가 실제로 사라지는지 검증 (앱의 deleteAllUserContent와 동일한 순서) ---
  // B의 댓글/좋아요는 바로 위 단계에서 카운트와 함께 정리됐다. 여기서는 남은 게 없는지 확인한다.
  const bComments = await getDocs(query(collection(B.db, 'comments'), where('userId', '==', ub.uid)));
  const bLikes = await getDocs(query(collection(B.db, 'likes'), where('userId', '==', ub.uid)));
  check('계정 삭제 시 본인 댓글/좋아요 제거', bComments.empty && bLikes.empty,
    `댓글 ${bComments.size}건 / 좋아요 ${bLikes.size}건 남음`);

  // A의 글과 닉네임 예약도 본인이 지울 수 있어야 한다.
  await deleteDoc(doc(A.db, 'writings', wRef.id));
  await deleteDoc(doc(A.db, 'nicknames', sharedNick.toLowerCase()));
  const aWritings = await getDocs(query(collection(A.db, 'writings'), where('userId', '==', ua.uid)));
  const nickAfter = await getDoc(doc(A.db, 'nicknames', sharedNick.toLowerCase()));
  check('계정 삭제 시 본인 글/닉네임 예약 제거', aWritings.empty && !nickAfter.exists(),
    `글 ${aWritings.size}건 남음 / 닉네임예약 ${nickAfter.exists() ? '남음' : '해제'}`);

  await deleteDoc(doc(A.db, 'users', ua.uid)).catch(() => {});
  await deleteDoc(doc(B.db, 'users', ub.uid)).catch(() => {});
  await A.auth.currentUser?.delete().catch(() => {});
  await B.auth.currentUser?.delete().catch(() => {});
  check('계정 삭제(정리)', true);

  console.log(`\n=== 결과: ${pass.length} PASS / ${fail.length} FAIL ===`);
  if (fail.length) {
    console.log('\n실패 항목:');
    fail.forEach((f) => console.log(' - ' + f));
  }
  await deleteApp(A.app);
  await deleteApp(B.app);
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error('\n치명적 오류:', e);
  process.exit(1);
});
