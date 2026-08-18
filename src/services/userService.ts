import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  getCountFromServer,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile } from '../types/models';
import { bumpDailyStats } from './statsService';

const usersCol = 'users';

export async function createUserProfile(uid: string, nickname: string): Promise<UserProfile> {
  const profile: UserProfile = {
    uid,
    nickname,
    photoURL: null,
    createdAt: Date.now(),
    writingCount: 0,
    publicPostCount: 0,
    streakCount: 0,
    lastWritingDate: null,
    blockedUserIds: [],
    earnedBadgeIds: [],
    bio: null,
    bestStreak: 0,
    preferredCategories: [],
    streakFreezes: 0,
    mutedKeywords: [],
  };
  await setDoc(doc(db, usersCol, uid), profile);
  bumpDailyStats({ newSignups: 1 }).catch(() => {});
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, usersCol, uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// 화면에 작성자 이름을 띄우려고 프로필을 읽는 곳이 많다(피드 카드마다 1건, 댓글, 알림함).
// 피드를 한 번 볼 때마다 같은 사람 프로필을 반복해서 읽게 되므로 짧게 캐시한다.
// 본인 프로필(AuthContext)은 항상 정확해야 하므로 위의 getUserProfile을 그대로 쓰고,
// 여기에는 "남의 이름을 보여주기 위한 조회"만 태운다.
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profileCache = new Map<string, { profile: UserProfile | null; at: number }>();
// 같은 프로필을 동시에 여러 카드가 요청하면 요청 하나로 합친다.
const inFlight = new Map<string, Promise<UserProfile | null>>();

export async function getDisplayProfile(uid: string): Promise<UserProfile | null> {
  const cached = profileCache.get(uid);
  if (cached && Date.now() - cached.at < PROFILE_CACHE_TTL_MS) return cached.profile;

  const pending = inFlight.get(uid);
  if (pending) return pending;

  const request = getUserProfile(uid)
    .then((profile) => {
      profileCache.set(uid, { profile, at: Date.now() });
      return profile;
    })
    .finally(() => {
      inFlight.delete(uid);
    });

  inFlight.set(uid, request);
  return request;
}

// 프로필이 바뀌면 캐시가 옛 이름을 붙들고 있지 않도록 즉시 버린다.
export function invalidateDisplayProfile(uid: string): void {
  profileCache.delete(uid);
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, usersCol, uid), data as Record<string, unknown>);
  invalidateDisplayProfile(uid);
}

export async function blockUser(uid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, usersCol, uid), { blockedUserIds: arrayUnion(targetUid) });
}

export async function unblockUser(uid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, usersCol, uid), { blockedUserIds: arrayRemove(targetUid) });
}

// 사람이 아니라 내용으로 거르는 뮤트. 저장은 원래 대소문자 그대로 해서 목록에 보여줄 때
// 사용자가 입력한 그대로 보이게 하고, 실제 비교(matchesMutedKeyword)에서만 소문자로 맞춘다.
export async function muteKeyword(uid: string, keyword: string): Promise<void> {
  const trimmed = keyword.trim();
  if (!trimmed) return;
  await updateDoc(doc(db, usersCol, uid), { mutedKeywords: arrayUnion(trimmed) });
}

export async function unmuteKeyword(uid: string, keyword: string): Promise<void> {
  await updateDoc(doc(db, usersCol, uid), { mutedKeywords: arrayRemove(keyword) });
}

export interface RecordWritingResult {
  profile: UserProfile;
  freezeUsed: boolean;
}

// 오늘 처음 작성했을 때만 호출한다. 연속 작성일수를 갱신하고 갱신된 프로필을 반환한다.
// 정확히 하루를 걸렀고(diffDays===2) 보호권이 있으면 하나 소비해 스트릭을 지킨다
// (2일 이상 거르면 보호권으로도 못 막는다 — "하루짜리 실수만 봐준다"는 게 이 기능의 취지).
export async function recordTodayWriting(uid: string, todayDateStr: string): Promise<RecordWritingResult | null> {
  const profile = await getUserProfile(uid);
  if (!profile) return null;
  if (profile.lastWritingDate === todayDateStr) return { profile, freezeUsed: false }; // 오늘 이미 기록됨

  let nextStreak = 1;
  let freezeUsed = false;
  const freezes = profile.streakFreezes ?? 0;
  if (profile.lastWritingDate) {
    const prev = new Date(profile.lastWritingDate);
    const today = new Date(todayDateStr);
    const diffDays = Math.round((today.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      nextStreak = profile.streakCount + 1;
    } else if (diffDays === 2 && freezes > 0) {
      nextStreak = profile.streakCount + 1;
      freezeUsed = true;
    } else {
      nextStreak = 1;
    }
  }

  const updated = {
    writingCount: profile.writingCount + 1,
    streakCount: nextStreak,
    bestStreak: Math.max(profile.bestStreak ?? 0, nextStreak),
    lastWritingDate: todayDateStr,
    streakFreezes: freezeUsed ? freezes - 1 : freezes,
  };
  await updateDoc(doc(db, usersCol, uid), updated);
  bumpDailyStats({ writingsCount: 1, activeUserId: uid }).catch(() => {});
  return { profile: { ...profile, ...updated }, freezeUsed };
}

// 프로필에 저장된 개수를 실제 문서 개수와 다시 맞춘다.
// 개수는 비정규화된 값이라 중간에 실패한 삭제·과거 버그 때문에 실제와 어긋날 수 있고,
// 사용자에게는 "내가 쓴 글 수"가 정확한 게 가장 중요하다(지우면 줄어야 한다).
// getCountFromServer는 문서를 전부 읽지 않고 집계만 가져오므로 호출당 비용이 작다.
// 값이 이미 맞으면 쓰기를 하지 않아 불필요한 요금이 발생하지 않는다.
export async function syncUserCounts(uid: string, profile: UserProfile): Promise<UserProfile> {
  const [writingsSnap, postsSnap] = await Promise.all([
    getCountFromServer(query(collection(db, 'writings'), where('userId', '==', uid))),
    getCountFromServer(query(collection(db, 'posts'), where('userId', '==', uid))),
  ]);
  const writingCount = writingsSnap.data().count;
  const publicPostCount = postsSnap.data().count;
  if (profile.writingCount === writingCount && profile.publicPostCount === publicPostCount) {
    return profile;
  }
  await updateDoc(doc(db, usersCol, uid), { writingCount, publicPostCount });
  return { ...profile, writingCount, publicPostCount };
}

export async function adjustPublicPostCount(uid: string, delta: 1 | -1): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) return;
  await updateDoc(doc(db, usersCol, uid), { publicPostCount: Math.max(0, profile.publicPostCount + delta) });
}

