import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
