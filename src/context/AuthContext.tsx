import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { createUserProfile, getUserProfile } from '../services/userService';
import { reserveNickname } from '../services/nicknameService';
import { signInWithLoginCode } from '../services/loginCodeService';
import { deleteAllUserContent } from '../services/accountService';
import { logEvent } from '../services/statsService';
import { getUnreadCount } from '../services/inboxService';
import { UserProfile } from '../types/models';
import { validateNickname } from '../utils/nickname';

// app_open은 앱 실행당 한 번만 남긴다. onAuthStateChanged는 토큰 갱신 등으로도
// 여러 번 불릴 수 있어 모듈 스코프 플래그로 중복을 막는다.
let appOpenLogged = false;

// 계정 삭제 시 비밀번호 재확인이 필요할 때 화면에서 구분할 수 있도록 쓰는 에러 코드.
export const REAUTH_REQUIRED = 'REAUTH_REQUIRED';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, nickname: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  loginWithCode: (code: string) => Promise<{ needsNickname: boolean }>;
  completeCodeSignup: (nickname: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  changeEmail: (currentPassword: string, newEmail: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  unreadNotifications: number;
  refreshUnreadNotifications: () => Promise<void>;
  emailVerified: boolean;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerified: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [emailVerified, setEmailVerified] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setEmailVerified(firebaseUser?.emailVerified ?? true);
      if (firebaseUser) {
        const p = await getUserProfile(firebaseUser.uid);
        setProfile(p);
        getUnreadCount(firebaseUser.uid).then(setUnreadNotifications).catch(() => {});
        if (!appOpenLogged) {
          appOpenLogged = true;
          logEvent('app_open', firebaseUser.uid).catch(() => {});
        }
      } else {
        setProfile(null);
        setUnreadNotifications(0);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // 설치된 PWA 아이콘에 안 읽은 알림 수를 배지로 띄운다(installed PWA만 실제로 보임).
  // Badging API는 Chrome/Edge 계열만 지원해(Firefox 미지원) 존재 여부를 먼저 확인한다.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (unreadNotifications > 0) {
      nav.setAppBadge?.(unreadNotifications).catch(() => {});
    } else {
      nav.clearAppBadge?.().catch(() => {});
    }
  }, [unreadNotifications]);

  async function refreshUnreadNotifications() {
    if (!user) return;
    setUnreadNotifications(await getUnreadCount(user.uid));
  }

  async function signUp(email: string, password: string, nickname: string) {
    const { valid, reason } = validateNickname(nickname);
    if (!valid) throw new Error(reason);

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try {
      // 닉네임 예약이 실패하면(중복) 방금 만든 계정을 되돌려 유령 계정이 남지 않게 한다.
      await reserveNickname(nickname, cred.user.uid);
    } catch (e) {
      await deleteUser(cred.user).catch(() => undefined);
      throw e;
    }

    const p = await createUserProfile(cred.user.uid, nickname.trim());
    setProfile(p);

    // 가입 직후 인증 메일을 보낸다. 실패해도(메일 서버 일시 오류 등) 가입 자체는
    // 막지 않는다 — 설정 화면에서 언제든 다시 보낼 수 있다.
    sendEmailVerification(cred.user).catch(() => {});
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  // 이메일이 없는 사용자(예: 학생)를 위한 5자리 코드 로그인. 처음 쓰는 코드면
  // 아직 닉네임이 없으므로(users/{uid} 프로필 없음) needsNickname을 true로 돌려주고,
  // 화면에서 completeCodeSignup으로 마무리해야 한다.
  async function loginWithCode(code: string): Promise<{ needsNickname: boolean }> {
    const { uid, hasProfile } = await signInWithLoginCode(code);
    if (hasProfile) {
      setProfile(await getUserProfile(uid));
    }
    return { needsNickname: !hasProfile };
  }

  // 코드로 처음 로그인한 사용자가 닉네임을 정하는 단계. 이미 인증은 끝난 상태라
  // signUp과 달리 계정을 새로 만들지 않고, 실패해도 롤백할 계정이 없다(코드는 계속 재사용됨).
  async function completeCodeSignup(nickname: string): Promise<void> {
    const current = auth.currentUser;
    if (!current) throw new Error('로그인 상태가 아니에요.');
    const { valid, reason } = validateNickname(nickname);
    if (!valid) throw new Error(reason);
    await reserveNickname(nickname, current.uid);
    setProfile(await createUserProfile(current.uid, nickname.trim()));
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  // 비밀번호 변경은 최근 로그인 상태를 요구하는 민감한 작업이라, 계정 삭제와
  // 마찬가지로 현재 비밀번호로 먼저 재인증한 뒤에 실제 변경을 수행한다.
  async function changePassword(currentPassword: string, newPassword: string) {
    const current = auth.currentUser;
    if (!current || !current.email) return;
    const credential = EmailAuthProvider.credential(current.email, currentPassword);
    await reauthenticateWithCredential(current, credential);
    await updatePassword(current, newPassword);
  }

  // 이메일 변경은 새 이메일로 인증 링크를 보내고, 사용자가 그 링크를 눌러야
  // 실제로 바뀐다(Firebase가 서버 쪽에서 처리) — 이 함수가 끝나도 아직 안 바뀐 상태다.
  // 예전 updateEmail은 미인증 이메일로도 즉시 바꿀 수 있어 계정 탈취 위험이 있었는데,
  // verifyBeforeUpdateEmail은 그 문제를 원천적으로 막는다.
  async function changeEmail(currentPassword: string, newEmail: string) {
    const current = auth.currentUser;
    if (!current || !current.email) return;
    const credential = EmailAuthProvider.credential(current.email, currentPassword);
    await reauthenticateWithCredential(current, credential);
    await verifyBeforeUpdateEmail(current, newEmail);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  // 계정과 사용자가 만든 모든 콘텐츠를 삭제한다.
  // Firebase는 마지막 로그인이 오래된 경우 삭제를 거부하므로, 그때는 비밀번호로 재인증한다.
  async function deleteAccount(password?: string) {
    const current = auth.currentUser;
    if (!current) return;

    if (password && current.email) {
      const credential = EmailAuthProvider.credential(current.email, password);
      await reauthenticateWithCredential(current, credential);
    }

    await deleteAllUserContent(current.uid, profile?.nickname);

    try {
      await deleteUser(current);
    } catch (e: any) {
      if (e?.code === 'auth/requires-recent-login') {
        throw new Error(REAUTH_REQUIRED);
      }
      throw e;
    }
  }

  async function refreshProfile() {
    if (!user) return;
    const p = await getUserProfile(user.uid);
    setProfile(p);
  }

  async function resendVerificationEmail() {
    const current = auth.currentUser;
    if (!current) return;
    await sendEmailVerification(current);
  }

  // emailVerified는 로그인 시점 토큰에 박힌 값이라, 메일함에서 링크를 누르고
  // 이 화면으로 돌아와도 저절로 갱신되지 않는다. reload()로 최신 상태를 다시
  // 받아와야 한다(설정 화면이 포커스될 때 호출).
  async function refreshEmailVerified() {
    const current = auth.currentUser;
    if (!current) return;
    await current.reload();
    setEmailVerified(auth.currentUser?.emailVerified ?? true);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp,
        signIn,
        loginWithCode,
        completeCodeSignup,
        resetPassword,
        changePassword,
        changeEmail,
        signOut,
        deleteAccount,
        refreshProfile,
        unreadNotifications,
        refreshUnreadNotifications,
        emailVerified,
        resendVerificationEmail,
        refreshEmailVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
