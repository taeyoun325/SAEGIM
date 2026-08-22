import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

// storage.rules의 profileImages/{uid}/{fileName} 규칙에 맞춰 고정 파일명으로 업로드한다.
// (덮어쓰기 방식이라 프로필 사진은 항상 최신 1장만 유지된다.)
export async function uploadProfileImage(uid: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const fileRef = ref(storage, `profileImages/${uid}/avatar.jpg`);
  await uploadBytes(fileRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(fileRef);
}

// 계정 삭제 시 호출. 프로필 사진을 올린 적이 없으면 파일이 없어 실패하므로 무시한다.
export async function deleteProfileImage(uid: string): Promise<void> {
  await deleteObject(ref(storage, `profileImages/${uid}/avatar.jpg`)).catch(() => {});
}
