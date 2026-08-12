// 특정 사용자를 관리자로 지정/해제한다.
// admins/{uid} 문서는 보안 규칙상 클라이언트가 쓸 수 없어, Admin SDK로만 만들 수 있다.
//
// 사용법:
//   node scripts/set-admin.js add <이메일>       관리자 지정
//   node scripts/set-admin.js remove <이메일>    관리자 해제
//   node scripts/set-admin.js list              관리자 목록
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

admin.initializeApp({ credential: admin.cert(require('../serviceAccountKey.json')) });
const db = getFirestore();
const auth = getAuth();

async function add(email) {
  const user = await auth.getUserByEmail(email);
  await db.collection('admins').doc(user.uid).set({
    uid: user.uid,
    email: user.email,
    createdAt: Date.now(),
  });
  console.log(`관리자로 지정했습니다: ${email} (uid: ${user.uid})`);
}

async function remove(email) {
  const user = await auth.getUserByEmail(email);
  await db.collection('admins').doc(user.uid).delete();
  console.log(`관리자에서 해제했습니다: ${email}`);
}

async function list() {
  const snap = await db.collection('admins').get();
  if (snap.empty) {
    console.log('관리자가 없습니다.');
    return;
  }
  console.log(`관리자 ${snap.size}명:`);
  snap.forEach((d) => console.log(`  - ${d.data().email || '(이메일 없음)'} (${d.id})`));
}

async function main() {
  const [cmd, email] = process.argv.slice(2);

  if (cmd === 'list') return list();
  if ((cmd === 'add' || cmd === 'remove') && email) {
    return cmd === 'add' ? add(email) : remove(email);
  }

  console.log('사용법:');
  console.log('  node scripts/set-admin.js add <이메일>');
  console.log('  node scripts/set-admin.js remove <이메일>');
  console.log('  node scripts/set-admin.js list');
  process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('오류:', e.message);
    process.exit(1);
  });
