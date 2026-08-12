const { GoogleAuth } = require('google-auth-library');
const https = require('https');

async function main() {
  const auth = new GoogleAuth({
    keyFile: '../serviceAccountKey.json',
    scopes: ['https://www.googleapis.com/auth/datastore'],
  });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  const projectId = require('../serviceAccountKey.json').project_id;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/-/indexes`;

  https.get(url, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
    let data = '';
    res.on('data', (d) => (data += d));
    res.on('end', () => {
      const json = JSON.parse(data);
      const indexes = (json.indexes || []).map((i) => ({
        collection: i.name.split('/').slice(-3, -2)[0],
        fields: i.fields.map((f) => `${f.fieldPath}:${f.order || f.arrayConfig}`).join(','),
        state: i.state,
      }));
      console.log(JSON.stringify(indexes, null, 2));
    });
  });
}

main();
