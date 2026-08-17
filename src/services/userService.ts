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
  };
  await setDoc(doc(db, usersCol, uid), profile);
  bumpDailyStats({ newSignups: 1 }).catch(() => {});
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, usersCol, uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, usersCol, uid), data as Record<string, unknown>);
}

export async function blockUser(uid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, usersCol, uid), { blockedUserIds: arrayUnion(targetUid) });
}

export async function unblockUser(uid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, usersCol, uid), { blockedUserIds: arrayRemove(targetUid) });
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

