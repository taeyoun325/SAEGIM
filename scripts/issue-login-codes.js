// 이메일이 없는 사용자(학생 등)에게 나눠줄 5자리 로그인 코드를 발급한다.
// 코드마다 실제 Firebase Auth 계정을 미리 만들고(비밀번호는 무작위, 코드로부터 유추 불가),
// loginCodes/{code} 문서에 이메일/비밀번호를 담아둔다 — 클라이언트는 로그인 시 이 문서를
// "코드로 직접 조회"해서 로그인 정보를 얻는다(목록 조회는 규칙에서 막혀 있음).
//
// 사용법:
//   node scripts/issue-login-codes.js <시작코드> <개수>
//   예) node scripts/issue-login-codes.js 10001 25
const crypto = require('crypto');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

admin.initializeApp({ credential: admin.cert(require('../serviceAccountKey.json')) });
const db = getFirestore();
const auth = getAuth();

function randomPassword() {
  return crypto.randomBytes(24).toString('base64url');
}

async function issueCode(code) {
  const email = `code-${code}@saegim-guest.local`;
  const password = randomPassword();

  const user = await auth.createUser({ email, password, emailVerified: true });
  await db.collection('loginCodes').doc(code).set({
    email,
    password,
    claimed: false,
    uid: null,
    createdAt: Date.now(),
  });
  return user.uid;
}

async function main() {
  const [startArg, countArg] = process.argv.slice(2);
  const start = parseInt(startArg, 10);
  const count = parseInt(countArg, 10);

  if (!Number.isInteger(start) || !Number.isInteger(count) || count <= 0) {
    console.log('사용법: node scripts/issue-login-codes.js <시작코드> <개수>');
    console.log('예)   node scripts/issue-login-codes.js 10001 25');
    process.exit(1);
  }

  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = String(start + i);
    if (code.length !== 5) {
      console.error(`5자리 코드가 아니에요: ${code} — 건너뜁니다.`);
      continue;
    }
    await issueCode(code);
    codes.push(code);
    console.log(`발급: ${code}`);
  }

  console.log('\n=== 발급된 코드 목록 ===');
  console.log(codes.join(', '));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('오류:', e.message);
    process.exit(1);
  });
