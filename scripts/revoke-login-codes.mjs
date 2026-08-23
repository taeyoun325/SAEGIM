// 발급된 로그인 코드 계정을 회수(삭제)한다.
// issue-login-codes.js로 만든 계정과 그 사용자가 남긴 콘텐츠를 함께 지운다.
//
// ⚠️ 되돌릴 수 없다. 실행 전 --dry-run으로 무엇이 지워질지 먼저 확인할 것.
//
// 사용법:
//   node scripts/revoke-login-codes.mjs --dry-run 10024 26262
//   node scripts/revoke-login-codes.mjs 10024 26262
import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

admin.initializeApp({ credential: admin.cert(JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = getFirestore();
const auth = getAuth();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const codes = args.filter((a) => !a.startsWith('--'));

if (codes.length === 0) {
  console.error('사용법: node scripts/revoke-login-codes.mjs [--dry-run] <코드...>');
  process.exit(1);
}

// 게시물은 먼저 지우고 딸린 문서를 정리해야 한다(보안 규칙의 postGone 원칙과 동일한 순서).
// Admin SDK는 규칙을 우회하지만, 순서를 맞춰야 앱과 같은 최종 상태가 된다.
async function deleteUserContent(uid) {
  const summary = { posts: 0, writings: 0, comments: 0, likes: 0, saves: 0, notifications: 0 };

  const myPosts = await db.collection('posts').where('userId', '==', uid).get();
  summary.posts = myPosts.size;
  for (const p of myPosts.docs) await p.ref.delete();
  for (const p of myPosts.docs) {
    for (const col of ['comments', 'likes', 'saves', 'notifications']) {
      const s = await db.collection(col).where('postId', '==', p.id).get();
      for (const d of s.docs) await d.ref.delete();
    }
  }

  for (const col of ['writings', 'comments', 'likes', 'saves', 'commentLikes']) {
    const s = await db.collection(col).where('userId', '==', uid).get();
    if (col in summary) summary[col] = s.size;
    for (const d of s.docs) await d.ref.delete();
  }
  for (const field of ['recipientId', 'actorId']) {
    const s = await db.collection('notifications').where(field, '==', uid).get();
    summary.notifications += s.size;
    for (const d of s.docs) await d.ref.delete();
  }
  return summary;
}

for (const code of codes) {
  const ref = db.collection('loginCodes').doc(code);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`${code}: loginCodes 문서 없음 — 건너뜀`);
    continue;
  }
  const { email } = snap.data();

  let uid = null;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    console.log(`${code}: Auth 계정 없음(${email})`);
  }

  let nickname = null;
  let counts = null;
  if (uid) {
    const prof = await db.collection('users').doc(uid).get();
    nickname = prof.exists ? prof.data().nickname : null;
    const [w, p] = await Promise.all([
      db.collection('writings').where('userId', '==', uid).get(),
      db.collection('posts').where('userId', '==', uid).get(),
    ]);
    counts = { writings: w.size, posts: p.size };
  }

  const label = `${code} (닉네임=${nickname ?? '없음'}, 글=${counts?.writings ?? 0}, 공개글=${counts?.posts ?? 0})`;
  if (dryRun) {
    console.log(`[미리보기] 삭제 예정: ${label}`);
    continue;
  }

  if (uid) {
    const s = await deleteUserContent(uid);
    await db.collection('users').doc(uid).delete().catch(() => {});
    if (nickname) await db.collection('nicknames').doc(nickname.toLowerCase()).delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
    console.log(`${label} → 콘텐츠 삭제 ${JSON.stringify(s)}`);
  }
  await ref.delete();
  console.log(`${code}: 코드 회수 완료`);
}

process.exit(0);
