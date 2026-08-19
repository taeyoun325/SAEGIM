import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { LoginCode } from '../types/models';
import { getUserProfile } from './userService';

const loginCodesCol = 'loginCodes';

export interface CodeSignInResult {
  uid: string;
  hasProfile: boolean; // false면 아직 닉네임을 정하지 않은 첫 로그인이다
}

// 코드는 Admin SDK로 미리 만들어둔 계정의 이메일/비밀번호를 가리키는 포인터다.
// 코드 문서를 못 찾으면(발급되지 않은 코드) 그 시점에서 바로 실패시켜, 존재하지 않는
// 계정을 함부로 만들지 않는다 — 계정 생성은 오직 Admin SDK 발급 스크립트만 한다.
export async function signInWithLoginCode(code: string): Promise<CodeSignInResult> {
  const ref = doc(db, loginCodesCol, code.trim());
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('유효하지 않은 코드예요.');
  }
  const { email, password, claimed } = snap.data() as LoginCode;
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(cred.user.uid);

  // claimed 표시는 순전히 발급 현황 확인용이라 실패해도 로그인 자체는 막지 않는다.
  if (!claimed) {
    await updateDoc(ref, { claimed: true, uid: cred.user.uid }).catch(() => {});
  }

  return { uid: cred.user.uid, hasProfile: !!profile };
}
