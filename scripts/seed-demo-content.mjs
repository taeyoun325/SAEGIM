// 스토어 스크린샷용 데모 콘텐츠 시드.
//
// 빈 화면("아직 공개한 생각이 없어요", 점 없는 캘린더)으로는 스토어 스크린샷을 찍을 수
// 없어서, 촬영용 계정 하나(hero)와 피드를 채울 계정 몇 개를 만들어 실제 글·좋아요·댓글을
// 남긴다. Admin SDK로 쓰기 때문에 도배 방지 쿨다운과 보안 규칙을 거치지 않는다
// (그래서 과거 날짜 글도 한 번에 만들 수 있다).
//
// ⚠️ 실제 운영 DB에 들어간다. 촬영이 끝나고 지우려면:
//     node scripts/seed-demo-content.mjs --clean
//
// 사용법: node scripts/seed-demo-content.mjs
import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

admin.initializeApp({
  credential: admin.cert(JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))),
});
const db = getFirestore();
const auth = getAuth();

const CLEAN = process.argv.includes('--clean');
const PASSWORD = 'saegim1234!';
const DOMAIN = '@saegim-demo.app';

// 앱의 src/utils/date.ts와 동일한 KST 기준
function kstNow() {
  const n = new Date();
  return new Date(n.getTime() + (9 * 60 + n.getTimezoneOffset()) * 60 * 1000);
}
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function promptIdOf(d) {
  return dateStr(d).replace(/-/g, '');
}
function daysAgo(n) {
  return new Date(kstNow().getTime() - n * 86400000);
}

// 촬영용 메인 계정. 캘린더 점 / 연속 새김 / 배지 / 펫 성장을 한꺼번에 보여준다.
const HERO = { key: 'hero', email: `demo${DOMAIN}`, nickname: '하루한줄' };

// 피드를 채울 계정들. 오늘 글감에 각자 다른 생각을 남긴다.
const FRIENDS = [
  { key: 'f1', email: `demo1${DOMAIN}`, nickname: '민서' },
  { key: 'f2', email: `demo2${DOMAIN}`, nickname: '도윤' },
  { key: 'f3', email: `demo3${DOMAIN}`, nickname: '밤하늘' },
  { key: 'f4', email: `demo4${DOMAIN}`, nickname: '초록이' },
  { key: 'f5', email: `demo5${DOMAIN}`, nickname: '서연' },
];
const ALL = [HERO, ...FRIENDS];

// 오늘 글감: "가장 기억에 남는 하루" — 공개 글이라 피드/상세 화면에 그대로 보인다.
// (글감은 Firestore prompts 문서가 우선이므로, 시드 전에 실제 제목을 확인하고 맞춰 썼다.)
const TODAY_POSTS = {
  hero: ['수능 끝나고 나온 교문 앞.', '엄마가 울면서 웃고 있었다.'],
  f1: ['아무 일도 없던 날.', '다 같이 웃었던 여름 저녁.', '그런 날이 제일 오래 남는다.'],
  f2: ['첫 출근 전날 밤.', '설레서 잠을 못 잤는데', '지금은 그 마음이 그립다.'],
  f3: ['할머니랑 마지막으로 시장 간 날.', '그날 산 참외를 아직 기억한다.'],
  f4: ['처음 비행기에서 구름 위를 봤을 때.', '세상이 갑자기 넓어졌다.'],
  f5: ['친구가 아무 말 없이 옆에 앉아 있어준 날.'],
};

// 지난 날짜의 hero 기록. 비공개라 캘린더/기록 화면에서만 보인다.
// [며칠 전, 그날의 실제 글감, 남긴 한 줄] — "한 줄이어도 충분해요"에 맞춰 짧게.
const HERO_PAST = [
  [1, '다시 돌아가고 싶은 순간', '아무 걱정 없이 자전거 타던 초등학교 여름.'],
  [2, '10년 후의 나', '지금보다 조금 더 느긋한 사람이었으면.'],
  [3, '용기', '거절당할 걸 알면서도 말해보는 것.'],
  [4, '자유', '아무 계획 없는 토요일 아침.'],
  [5, '실패', '실패한 게 아니라 아직 안 된 거라고 우겨본다.'],
  [6, '성공', '남들 기준 말고 내 기준으로 재보기로 했다.'],
  [7, '행복', '따뜻한 물로 씻고 나왔을 때 그 짧은 순간.'],
  [8, '여름', '밤에 창문 열어두면 들리는 매미 소리.'],
  [9, '후회', '말하지 않은 것들이 대부분이다.'],
  [10, '꿈', '이제는 크지 않아도 되는 꿈을 꾼다.'],
  [11, '가족', '말없이 밥그릇을 채워주는 방식의 사랑.'],
  [12, '우정', '오래 안 봐도 어제 본 것 같은 사람.'],
  [13, '겨울', '겨울 아침의 조용함이 좋다.'],
  [14, '취향', '취향은 내가 나를 설명하는 방식.'],
  [15, '습관', '자기 전에 물 한 잔. 이건 지켰다.'],
  [16, '변화', '안 변하는 게 더 무서워졌다.'],
  [17, '기다림', '기다리는 동안에도 시간은 내 것이었다.'],
  [18, '외로움', '혼자인 것과 외로운 건 다르다.'],
  [19, '설렘', '별거 아닌 약속이 하루를 버티게 한다.'],
];

async function ensureUser(email, nickname) {
  try {
    const u = await auth.getUserByEmail(email);
    return u.uid;
  } catch {
    const u = await auth.createUser({ email, password: PASSWORD, displayName: nickname });
    return u.uid;
  }
}

async function clean() {
  console.log('데모 콘텐츠를 정리합니다...\n');
  for (const person of ALL) {
    let uid;
    try {
      uid = (await auth.getUserByEmail(person.email)).uid;
    } catch {
      console.log(`- ${person.nickname}: 계정 없음(건너뜀)`);
      continue;
    }
    for (const col of ['posts', 'writings', 'likes', 'comments', 'saves', 'commentLikes']) {
      const snap = await db.collection(col).where('userId', '==', uid).get();
      for (const d of snap.docs) await d.ref.delete();
    }
    for (const field of ['recipientId', 'actorId']) {
      const snap = await db.collection('notifications').where(field, '==', uid).get();
      for (const d of snap.docs) await d.ref.delete();
    }
    await db.collection('users').doc(uid).delete().catch(() => {});
    await db.collection('nicknames').doc(person.nickname.toLowerCase()).delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
    console.log(`- ${person.nickname}: 정리 완료`);
  }
  console.log('\n정리가 끝났습니다.');
}

async function seed() {
  const today = kstNow();
  const todayPromptId = promptIdOf(today);
  const todayStr = dateStr(today);

  // 오늘 글감 제목을 확인해 로그로 보여준다(Firestore 시드가 있으면 그것이 우선).
  const promptSnap = await db.collection('prompts').doc(todayPromptId).get();
  console.log(`오늘(${todayStr}) 글감: ${promptSnap.exists ? promptSnap.data().title : '(폴백 풀에서 결정)'}\n`);

  const uids = {};
  for (const p of ALL) {
    uids[p.key] = await ensureUser(p.email, p.nickname);
  }

  // --- 프로필 문서 ---
  for (const p of ALL) {
    const isHero = p.key === 'hero';
    const writingCount = isHero ? HERO_PAST.length + 1 : 1;
    await db.collection('users').doc(uids[p.key]).set({
      uid: uids[p.key],
      nickname: p.nickname,
      photoURL: null,
      avatarType: isHero ? 'pet' : 'name',
      createdAt: Date.now() - (isHero ? 25 : 5) * 86400000,
      writingCount,
      publicPostCount: 1,
      streakCount: isHero ? HERO_PAST.length + 1 : 1,
      bestStreak: isHero ? HERO_PAST.length + 1 : 1,
      lastWritingDate: todayStr,
      blockedUserIds: [],
      earnedBadgeIds: isHero
        ? ['writing_1', 'writing_10', 'streak_3', 'streak_7', 'streak_15', 'likes_1']
        : ['writing_1'],
      streakFreezes: isHero ? 3 : 0,
      monthlyGoal: isHero ? 20 : null,
      // 펫: hero는 20편을 새겨 4단계(36편 전)까지 자란 상태로 둔다.
      characterSpeciesId: isHero ? 'star' : null,
      characterStageOverride: isHero ? 3 : null,
      characterAffection: isHero ? 8 : 0,
      characterLastFedDate: null, // 촬영 때 "먹이 주기"를 눌러볼 수 있게 비워둔다
      characterEquippedAccessoryId: isHero ? 'cap' : null,
      characterObtainedSpeciesIds: [],
    });
    await db.collection('nicknames').doc(p.nickname.toLowerCase()).set({
      uid: uids[p.key],
      nickname: p.nickname,
      createdAt: Date.now(),
    });
  }
  console.log(`계정/프로필 ${ALL.length}개 준비 완료`);

  // --- hero의 지난 기록(비공개) : 캘린더 점 + 연속 새김 ---
  for (const [ago, , line] of HERO_PAST) {
    const d = daysAgo(ago);
    const ts = d.getTime();
    await db.collection('writings').add({
      userId: uids.hero,
      promptId: promptIdOf(d),
      lines: [line],
      visibility: 'private',
      createdAt: ts,
      postId: null,
    });
  }
  console.log(`hero 지난 기록 ${HERO_PAST.length}일치 생성 (캘린더/연속 새김용)`);

  // --- 오늘 글: 전원 공개 게시 ---
  const postIds = {};
  for (const p of ALL) {
    const lines = TODAY_POSTS[p.key];
    const createdAt = Date.now() - Math.floor(Math.random() * 6 * 3600 * 1000);
    const writingRef = await db.collection('writings').add({
      userId: uids[p.key],
      promptId: todayPromptId,
      lines,
      visibility: 'public',
      createdAt,
      postId: null,
      mood: p.key === 'hero' ? '😊' : null,
    });
    const postRef = await db.collection('posts').add({
      writingId: writingRef.id,
      userId: uids[p.key],
      promptId: todayPromptId,
      lines,
      createdAt,
      likeCount: 0,
      commentCount: 0,
    });
    await writingRef.update({ postId: postRef.id });
    postIds[p.key] = postRef.id;
  }
  console.log(`오늘의 공개 글 ${ALL.length}개 게시`);

  // --- 좋아요: 서로 눌러준다(글마다 2~5개) ---
  const likePlan = {
    hero: ['f1', 'f2', 'f3', 'f4', 'f5'], // hero 글에 5명 전원
    f1: ['hero', 'f2', 'f4'],
    f2: ['hero', 'f3', 'f5', 'f1'],
    f3: ['hero', 'f4'],
    f4: ['hero', 'f1', 'f5'],
    f5: ['hero', 'f2', 'f3'],
  };
  for (const [target, likers] of Object.entries(likePlan)) {
    for (const liker of likers) {
      const postId = postIds[target];
      const id = `${postId}_${uids[liker]}`;
      await db.collection('likes').doc(id).set({
        id, postId, userId: uids[liker], createdAt: Date.now(),
      });
    }
    await db.collection('posts').doc(postIds[target]).update({ likeCount: likers.length });
  }
  console.log('좋아요 반영 완료 (hero 글 5개 포함)');

  // --- 댓글: hero 글과 몇몇 글에 자연스러운 반응 ---
  const comments = [
    ['hero', 'f1', '교문 앞 장면이 그려지네요. 저도 그날이 떠올라요.'],
    ['hero', 'f3', '어머니 표정이 눈에 선해요 :)'],
    ['f2', 'f5', '설렜던 마음이 그리워지는 순간, 정말 공감돼요.'],
    ['f1', 'hero', '아무 일 없던 날이 제일 오래 남더라고요.'],
  ];
  const commentCounts = {};
  for (const [target, author, content] of comments) {
    const authorPerson = ALL.find((p) => p.key === author);
    await db.collection('comments').add({
      postId: postIds[target],
      userId: uids[author],
      authorNickname: authorPerson.nickname,
      content,
      createdAt: Date.now() - Math.floor(Math.random() * 2 * 3600 * 1000),
      likeCount: 0,
      parentCommentId: null,
    });
    commentCounts[target] = (commentCounts[target] || 0) + 1;
  }
  for (const [target, count] of Object.entries(commentCounts)) {
    await db.collection('posts').doc(postIds[target]).update({ commentCount: count });
  }
  console.log(`댓글 ${comments.length}개 작성`);

  console.log('\n=== 시드 완료 ===');
  console.log('촬영용 계정으로 로그인하세요:');
  console.log(`  이메일: ${HERO.email}`);
  console.log(`  비밀번호: ${PASSWORD}`);
  console.log(`  닉네임: ${HERO.nickname} (펫 4단계 / 연속 ${HERO_PAST.length + 1}일 / 배지 6개)`);
  console.log('\n촬영 후 정리: node scripts/seed-demo-content.mjs --clean');
}

(CLEAN ? clean() : seed())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('오류:', e);
    process.exit(1);
  });
