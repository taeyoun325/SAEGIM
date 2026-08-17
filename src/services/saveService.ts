import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Post } from '../types/models';
import { getPostById } from './postService';

const savesCol = 'saves';

function saveDocId(postId: string, userId: string): string {
  return `${postId}_${userId}`;
}

export async function toggleSave(postId: string, userId: string): Promise<boolean> {
  const saveRef = doc(db, savesCol, saveDocId(postId, userId));
  const snap = await getDoc(saveRef);
  if (snap.exists()) {
    await deleteDoc(saveRef);
    return false;
  }
  await setDoc(saveRef, { id: saveDocId(postId, userId), postId, userId, createdAt: Date.now() });
  return true;
}

export async function hasSaved(postId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, savesCol, saveDocId(postId, userId)));
  return snap.exists();
}

// 저장한 글을 최신순으로 가져온다. 저장 문서에는 postId만 있어 게시물을 개별 조회한다
// (삭제된 게시물은 null이 되므로 걸러낸다).
export async function getSavedPosts(userId: string): Promise<Post[]> {
  const q = query(collection(db, savesCol), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const postIds = snap.docs.map((d) => d.data().postId as string);
  const posts = await Promise.all(postIds.map((id) => getPostById(id)));
  return posts.filter((p): p is Post => p !== null);
}
