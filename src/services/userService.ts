import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
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

// 오늘 처음 작성했을 때만 호출한다. 연속 작성일수를 갱신하고 갱신된 프로필을 반환한다.
export async function recordTodayWriting(uid: string, todayDateStr: string): Promise<UserProfile | null> {
  const profile = await getUserProfile(uid);
  if (!profile) return null;
  if (profile.lastWritingDate === todayDateStr) return profile; // 오늘 이미 기록됨

  let nextStreak = 1;
  if (profile.lastWritingDate) {
    const prev = new Date(profile.lastWritingDate);
    const today = new Date(todayDateStr);
    const diffDays = Math.round((today.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    nextStreak = diffDays === 1 ? profile.streakCount + 1 : 1;
  }

  const updated = {
    writingCount: profile.writingCount + 1,
    streakCount: nextStreak,
    lastWritingDate: todayDateStr,
  };
  await updateDoc(doc(db, usersCol, uid), updated);
  bumpDailyStats({ writingsCount: 1, activeUserId: uid }).catch(() => {});
  return { ...profile, ...updated };
}

export async function adjustPublicPostCount(uid: string, delta: 1 | -1): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) return;
  await updateDoc(doc(db, usersCol, uid), { publicPostCount: Math.max(0, profile.publicPostCount + delta) });
}
