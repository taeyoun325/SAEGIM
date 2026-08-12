import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';

// 닉네임 유니크 보장.
// nicknames/{소문자닉네임} 문서를 예약 티켓처럼 사용한다. 문서 ID가 곧 유니크 제약이 되므로
// 동시에 같은 닉네임으로 가입해도 트랜잭션에서 한 명만 성공한다.
const nicknamesCol = 'nicknames';

function nicknameKey(nickname: string): string {
  return nickname.trim().toLowerCase();
}

export async function isNicknameTaken(nickname: string): Promise<boolean> {
  const snap = await getDoc(doc(db, nicknamesCol, nicknameKey(nickname)));
  return snap.exists();
}

// 닉네임을 예약한다. 이미 사용 중이면 에러를 던진다.
export async function reserveNickname(nickname: string, uid: string): Promise<void> {
  const ref = doc(db, nicknamesCol, nicknameKey(nickname));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      throw new Error('이미 사용 중인 닉네임이에요.');
    }
    tx.set(ref, { uid, nickname: nickname.trim(), createdAt: Date.now() });
  });
}
