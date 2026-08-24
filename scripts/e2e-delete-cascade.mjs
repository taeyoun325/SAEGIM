// 삭제 연쇄(cascade) 회귀 테스트.
//
// 실제로 보고된 버그: "다른 사람이 좋아요/댓글을 남긴 글은 삭제가 실패한다."
// 딸린 문서(좋아요·저장·댓글·댓글좋아요·알림)는 남이 만든 것이라 평소엔 본인만 지울 수
// 있고, 보안 규칙은 "대상이 이미 사라져 고아가 됐을 때"만 남의 것 정리를 허용한다.
// 그래서 앱 코드는 반드시 원본(글/댓글)을 먼저 지운 뒤 딸린 문서를 정리해야 한다.
//
// 이 스크립트는 그 순서가 실제 규칙 아래서 동작하는지, 그리고 "글이 살아있는 동안에는
// 주인이라도 남의 좋아요/댓글을 못 지운다"는 보안 조건이 유지되는지 함께 검증한다.
//
// 사용법: node scripts/e2e-delete-cascade.mjs
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, addDoc, collection, deleteDoc,
  query, where, getDocs, writeBatch, serverTimestamp, increment, updateDoc,
} from 'firebase/firestore';

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
  (ok ? pass : fail).push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const nowForPrompt = new Date();
const kstNow = new Date(nowForPrompt.getTime() + (9 * 60 + nowForPrompt.getTimezoneOffset()) * 60 * 1000);
const promptId = `${kstNow.getFullYear()}${String(kstNow.getMonth() + 1).padStart(2, '0')}${String(kstNow.getDate()).padStart(2, '0')}`;

async function session(label) {
  const app = initializeApp(config, label);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}

// 앱의 postService.deletePostRelatedContent와 같은 순서/방식.
async function deleteDocsWhere(db, col, field, value) {
  const snap = await getDocs(query(collection(db, col), where(field, '==', value)));
  for (const d of snap.docs) await deleteDoc(d.ref);
  return snap.size;
}

async function main() {
  const A = await session('cascadeA'); // 글/댓글 작성자
  const B = await session('cascadeB'); // 반응(좋아요·저장·댓글)을 남기는 사용자
  // 댓글 생성에는 15초 쿨다운이 걸려 있어, 2단계에서 답글을 달 사람은 따로 둔다
  // (같은 계정으로 연속 댓글을 달면 도배 방지 규칙에 정상적으로 막힌다).
  const C = await session('cascadeC');
  const D = await session('cascadeD'); // 3단계(탈퇴)에서 댓글을 남길 사람
  const stamp = Date.now();
  // 닉네임은 보안 규칙이 2~12자로 제한하므로(validNickname) 타임스탬프를 통째로 붙일 수 없다.
  const nickSuffix = stamp.toString().slice(-5);
  const password = 'e2eTest1234!';

  const { user: ua } = await createUserWithEmailAndPassword(A.auth, `e2e.del.a.${stamp}@saegim-test.dev`, password);
  const { user: ub } = await createUserWithEmailAndPassword(B.auth, `e2e.del.b.${stamp}@saegim-test.dev`, password);
  const { user: uc } = await createUserWithEmailAndPassword(C.auth, `e2e.del.c.${stamp}@saegim-test.dev`, password);
  const { user: ud } = await createUserWithEmailAndPassword(D.auth, `e2e.del.d.${stamp}@saegim-test.dev`, password);
  for (const [s, u, nick] of [[A, ua, `삭제A${nickSuffix}`], [B, ub, `삭제B${nickSuffix}`], [C, uc, `삭제C${nickSuffix}`], [D, ud, `삭제D${nickSuffix}`]]) {
    await setDoc(doc(s.db, 'users', u.uid), {
      uid: u.uid, nickname: nick, photoURL: null, createdAt: Date.now(),
      writingCount: 0, publicPostCount: 0, streakCount: 0, lastWritingDate: null, blockedUserIds: [],
    });
  }
  check('테스트 계정 생성', true);

  // --- A가 글을 쓰고 공개 ---
  const wBatch = writeBatch(A.db);
  const wRef = doc(collection(A.db, 'writings'));
  wBatch.set(wRef, {
    userId: ua.uid, promptId, lines: ['삭제 연쇄 테스트'], visibility: 'private',
    createdAt: Date.now(), postId: null,
  });
  stampRateLimit(wBatch, A.db, ua.uid, 'writing');
  await wBatch.commit();

  const postRef = await addDoc(collection(A.db, 'posts'), {
    writingId: wRef.id, userId: ua.uid, promptId, lines: ['삭제 연쇄 테스트'],
    createdAt: Date.now(), likeCount: 0, commentCount: 0,
  });
  await updateDoc(wRef, { visibility: 'public', postId: postRef.id });
  check('A 글 게시', true);

  // --- B가 좋아요/저장/댓글을 남긴다(= 남이 만든 딸린 문서) ---
  const likeId = `${postRef.id}_${ub.uid}`;
  const likeBatch = writeBatch(B.db);
  likeBatch.set(doc(B.db, 'likes', likeId), { id: likeId, postId: postRef.id, userId: ub.uid, createdAt: Date.now() });
  likeBatch.update(doc(B.db, 'posts', postRef.id), { likeCount: increment(1) });
  await likeBatch.commit();

  const saveId = `${postRef.id}_${ub.uid}`;
  await setDoc(doc(B.db, 'saves', saveId), { id: saveId, postId: postRef.id, userId: ub.uid, createdAt: Date.now() });

  const cBatch = writeBatch(B.db);
  const cRef = doc(collection(B.db, 'comments'));
  cBatch.set(cRef, {
    postId: postRef.id, userId: ub.uid, authorNickname: `삭제B${nickSuffix}`,
    content: 'B의 댓글', createdAt: Date.now(), likeCount: 0, parentCommentId: null,
  });
  cBatch.update(doc(B.db, 'posts', postRef.id), { commentCount: increment(1) });
  stampRateLimit(cBatch, B.db, ub.uid, 'comment');
  await cBatch.commit();
  check('B가 좋아요/저장/댓글 남김', true);

  // --- 보안: 글이 살아있는 동안에는 주인이라도 남의 좋아요/댓글을 못 지운다 ---
  try {
    await deleteDoc(doc(A.db, 'likes', likeId));
    check('글 살아있을 때 타인 좋아요 삭제 차단', false, 'A가 B의 좋아요를 지움(취약)');
  } catch {
    check('글 살아있을 때 타인 좋아요 삭제 차단', true);
  }
  try {
    await deleteDoc(doc(A.db, 'comments', cRef.id));
    check('글 살아있을 때 타인 댓글 삭제 차단', false, 'A가 B의 댓글을 지움(취약)');
  } catch {
    check('글 살아있을 때 타인 댓글 삭제 차단', true);
  }

  // --- 핵심: A가 자기 글을 삭제 (앱 deletePost와 동일한 순서) ---
  let deleteError = null;
  try {
    await deleteDoc(doc(A.db, 'posts', postRef.id)); // 1) 게시물 먼저
    await deleteDocsWhere(A.db, 'comments', 'postId', postRef.id); // 2) 딸린 문서 정리
    await deleteDocsWhere(A.db, 'likes', 'postId', postRef.id);
    await deleteDocsWhere(A.db, 'saves', 'postId', postRef.id);
    // 앱과 동일하게 알림 정리까지 포함한다 — 이 쿼리는 read 규칙으로 판정되므로
    // 여기를 빼두면 실제 앱에서만 실패하는 버그를 테스트가 놓친다(실제로 놓쳤었다).
    await deleteDocsWhere(A.db, 'notifications', 'postId', postRef.id);
    await updateDoc(wRef, { visibility: 'private', postId: null }); // 3) 원본 글 되돌리기
  } catch (e) {
    deleteError = e;
  }
  check('반응이 달린 글 삭제 성공', deleteError === null, deleteError ? String(deleteError.code || deleteError) : '');

  const [likeLeft, saveLeft, commentLeft, postLeft] = await Promise.all([
    getDocs(query(collection(A.db, 'likes'), where('postId', '==', postRef.id))),
    getDocs(query(collection(A.db, 'saves'), where('postId', '==', postRef.id))),
    getDocs(query(collection(A.db, 'comments'), where('postId', '==', postRef.id))),
    getDoc(doc(A.db, 'posts', postRef.id)),
  ]);
  check('딸린 좋아요/저장/댓글 모두 정리됨', likeLeft.empty && saveLeft.empty && commentLeft.empty,
    `좋아요 ${likeLeft.size} / 저장 ${saveLeft.size} / 댓글 ${commentLeft.size} 남음`);
  check('게시물 제거 확인', !postLeft.exists());

  // ============================================================
  // 댓글 삭제 연쇄: 남의 답글 + 남의 댓글좋아요가 달린 댓글 지우기
  // ============================================================
  let post2;
  try {
    post2 = await addDoc(collection(A.db, 'posts'), {
      writingId: wRef.id, userId: ua.uid, promptId, lines: ['댓글 삭제 테스트'],
      createdAt: Date.now(), likeCount: 0, commentCount: 0,
    });
    check('2단계용 글 생성', true);
  } catch (e) {
    check('2단계용 글 생성', false, String(e.code || e));
    throw e;
  }

  // A가 원댓글을 단다(쿨다운 때문에 A 계정으로 새로 작성).
  const parentBatch = writeBatch(A.db);
  const parentRef = doc(collection(A.db, 'comments'));
  parentBatch.set(parentRef, {
    postId: post2.id, userId: ua.uid, authorNickname: `삭제A${nickSuffix}`,
    content: 'A의 원댓글', createdAt: Date.now(), likeCount: 0, parentCommentId: null,
  });
  parentBatch.update(doc(A.db, 'posts', post2.id), { commentCount: increment(1) });
  stampRateLimit(parentBatch, A.db, ua.uid, 'comment');
  try {
    await parentBatch.commit();
    check('A 원댓글 작성', true);
  } catch (e) {
    check('A 원댓글 작성', false, String(e.code || e));
    throw e;
  }

  // C가 그 댓글에 답글을, B가 좋아요를 남긴다(= 남이 만든 딸린 문서).
  const replyBatch = writeBatch(C.db);
  const replyRef = doc(collection(C.db, 'comments'));
  replyBatch.set(replyRef, {
    postId: post2.id, userId: uc.uid, authorNickname: `삭제C${nickSuffix}`,
    content: 'C의 답글', createdAt: Date.now(), likeCount: 0, parentCommentId: parentRef.id,
  });
  replyBatch.update(doc(C.db, 'posts', post2.id), { commentCount: increment(1) });
  stampRateLimit(replyBatch, C.db, uc.uid, 'comment');
  try {
    await replyBatch.commit();
    check('C 답글 작성', true);
  } catch (e) {
    check('C 답글 작성', false, String(e.code || e));
    throw e;
  }

  const clId = `${parentRef.id}_${ub.uid}`;
  await setDoc(doc(B.db, 'commentLikes', clId), {
    id: clId, commentId: parentRef.id, postId: post2.id, userId: ub.uid, createdAt: Date.now(),
  });
  check('B가 댓글좋아요 남김', true);

  // 보안: 댓글이 살아있는 동안 남의 댓글좋아요를 못 지운다.
  try {
    await deleteDoc(doc(A.db, 'commentLikes', clId));
    check('댓글 살아있을 때 타인 댓글좋아요 삭제 차단', false, 'A가 B의 댓글좋아요를 지움(취약)');
  } catch {
    check('댓글 살아있을 때 타인 댓글좋아요 삭제 차단', true);
  }

  // 핵심: A가 자기 댓글 삭제 (앱 deleteComment와 동일한 순서: 원댓글 → 답글 → 좋아요)
  let commentDeleteError = null;
  try {
    await deleteDoc(doc(A.db, 'comments', parentRef.id));
    await deleteDoc(doc(A.db, 'comments', replyRef.id));
    await deleteDocsWhere(A.db, 'commentLikes', 'commentId', replyRef.id);
    await deleteDocsWhere(A.db, 'commentLikes', 'commentId', parentRef.id);
  } catch (e) {
    commentDeleteError = e;
  }
  check('답글/좋아요 달린 댓글 삭제 성공', commentDeleteError === null,
    commentDeleteError ? String(commentDeleteError.code || commentDeleteError) : '');

  const [replyLeft, clLeft] = await Promise.all([
    getDocs(query(collection(A.db, 'comments'), where('parentCommentId', '==', parentRef.id))),
    getDocs(query(collection(A.db, 'commentLikes'), where('commentId', '==', parentRef.id))),
  ]);
  check('답글/댓글좋아요 모두 정리됨', replyLeft.empty && clLeft.empty,
    `답글 ${replyLeft.size} / 댓글좋아요 ${clLeft.size} 남음`);

  // ============================================================
  // 계정 삭제: 남의 반응이 달린 내 글을 가진 채로 탈퇴할 수 있는가
  // (앱 accountService.deleteAllUserContent와 같은 순서를 그대로 재현한다)
  // ============================================================
  const post3 = await addDoc(collection(A.db, 'posts'), {
    writingId: wRef.id, userId: ua.uid, promptId, lines: ['탈퇴 테스트'],
    createdAt: Date.now(), likeCount: 0, commentCount: 0,
  });
  // B가 좋아요, C가 댓글을 남긴다.
  const l3 = `${post3.id}_${ub.uid}`;
  const l3Batch = writeBatch(B.db);
  l3Batch.set(doc(B.db, 'likes', l3), { id: l3, postId: post3.id, userId: ub.uid, createdAt: Date.now() });
  l3Batch.update(doc(B.db, 'posts', post3.id), { likeCount: increment(1) });
  await l3Batch.commit();

  const c3Batch = writeBatch(D.db);
  const c3Ref = doc(collection(D.db, 'comments'));
  c3Batch.set(c3Ref, {
    postId: post3.id, userId: ud.uid, authorNickname: `삭제D${nickSuffix}`,
    content: 'D의 댓글', createdAt: Date.now(), likeCount: 0, parentCommentId: null,
  });
  c3Batch.update(doc(D.db, 'posts', post3.id), { commentCount: increment(1) });
  stampRateLimit(c3Batch, D.db, ud.uid, 'comment');
  try {
    await c3Batch.commit();
    check('탈퇴 테스트용 글에 남의 반응 추가', true);
  } catch (e) {
    check('탈퇴 테스트용 글에 남의 반응 추가', false, String(e.code || e));
    throw e;
  }

  let accountDeleteError = null;
  try {
    // 1) 내 게시물을 먼저 지우고 2) 딸린 남의 문서를 정리한다.
    const myPosts = await getDocs(query(collection(A.db, 'posts'), where('userId', '==', ua.uid)));
    for (const p of myPosts.docs) await deleteDoc(p.ref);
    for (const p of myPosts.docs) {
      await deleteDocsWhere(A.db, 'comments', 'postId', p.id);
      await deleteDocsWhere(A.db, 'likes', 'postId', p.id);
      await deleteDocsWhere(A.db, 'saves', 'postId', p.id);
      await deleteDocsWhere(A.db, 'notifications', 'postId', p.id);
    }
    // 3) 내 글/닉네임/프로필 정리
    await deleteDocsWhere(A.db, 'writings', 'userId', ua.uid);
    await deleteDoc(doc(A.db, 'users', ua.uid));
  } catch (e) {
    accountDeleteError = e;
  }
  check('남의 반응이 달린 글을 가진 계정 탈퇴 성공', accountDeleteError === null,
    accountDeleteError ? String(accountDeleteError.code || accountDeleteError) : '');

  const [l3Left, c3Left, p3Left] = await Promise.all([
    getDocs(query(collection(B.db, 'likes'), where('postId', '==', post3.id))),
    getDocs(query(collection(B.db, 'comments'), where('postId', '==', post3.id))),
    getDoc(doc(B.db, 'posts', post3.id)),
  ]);
  check('탈퇴 후 남의 좋아요/댓글까지 정리됨', l3Left.empty && c3Left.empty && !p3Left.exists(),
    `좋아요 ${l3Left.size} / 댓글 ${c3Left.size} 남음`);

  // --- 정리 ---
  await deleteDoc(doc(A.db, 'posts', post2.id)).catch(() => {});
  await deleteDoc(wRef).catch(() => {});
  await deleteDoc(doc(A.db, 'users', ua.uid)).catch(() => {});
  await deleteDoc(doc(B.db, 'users', ub.uid)).catch(() => {});
  await deleteDoc(doc(C.db, 'users', uc.uid)).catch(() => {});
  await deleteDoc(doc(D.db, 'users', ud.uid)).catch(() => {});
  await A.auth.currentUser?.delete().catch(() => {});
  await B.auth.currentUser?.delete().catch(() => {});
  await C.auth.currentUser?.delete().catch(() => {});
  await D.auth.currentUser?.delete().catch(() => {});

  console.log(`\n=== 결과: ${pass.length} PASS / ${fail.length} FAIL ===`);
  if (fail.length) {
    console.log('실패 항목:');
    fail.forEach((f) => console.log(' -', f));
  }
  await deleteApp(A.app);
  await deleteApp(B.app);
  await deleteApp(C.app);
  await deleteApp(D.app);
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error('치명적 오류:', e);
  process.exit(1);
});
