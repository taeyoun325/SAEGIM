// reports(status, createdAt) 인덱스가 사용 가능한 상태인지 확인한다.
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp({ credential: admin.cert(require('../serviceAccountKey.json')) });
const db = getFirestore();

async function main() {
  try {
    await db.collection('reports').where('status', '==', 'pending').orderBy('createdAt', 'desc').limit(1).get();
    console.log('READY');
  } catch (e) {
    console.log('NOT_READY:', e.message.slice(0, 70));
  }
  process.exit(0);
}

main();
