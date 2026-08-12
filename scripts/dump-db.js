const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp({ credential: admin.cert(require('../serviceAccountKey.json')) });
const db = getFirestore();

async function main() {
  for (const col of ['users', 'writings', 'posts', 'likes', 'comments', 'reports']) {
    const snap = await db.collection(col).get();
    console.log(`\n=== ${col} (${snap.size}) ===`);
    snap.forEach((d) => console.log(d.id, JSON.stringify(d.data())));
  }
  process.exit(0);
}

main();
