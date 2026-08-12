const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp({ credential: admin.cert(require('../serviceAccountKey.json')) });
const db = getFirestore();

async function main() {
  try {
    await db.collection('writings').where('userId', '==', 'x').orderBy('createdAt', 'desc').get();
    console.log('READY');
  } catch (e) {
    console.log('NOT_READY:', e.message.slice(0, 60));
  }
  process.exit(0);
}

main();
