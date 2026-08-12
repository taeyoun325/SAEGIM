import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Post, Writing } from '../types/models';
import { linkWritingToPost, updateWritingVisibility } from './writingService';
import { FEED_PAGE_SIZE } from '../constants/config';

const postsCol = 'posts';

export async function publishWriting(writing: Writing): Promise<string> {
  const now = Date.now();
  const postRef = await addDoc(collection(db, postsCol), {
    writingId: writing.id,
    userId: writing.userId,
    promptId: writing.promptId,
    lines: writing.lines,
    createdAt: now,
    likeCount: 0,
    commentCount: 0,
  } satisfies Omit<Post, 'id'>);
  await updateWritingVisibility(writing.id, 'public');
  await linkWritingToPost(writing.id, postRef.id);
  return postRef.id;
}

export async function unpublishPost(postId: string, writingId: string): Promise<void> {
  await deleteDoc(doc(db, postsCol, postId));
  await updateWritingVisibility(writingId, 'private');
  await linkWritingToPost(writingId, null);
}

export async function getPostById(postId: string): Promise<Post | null> {
  const snap = await getDoc(doc(db, postsCol, postId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Post) : null;
}

export interface FeedPage {
  posts: Post[];
  lastDoc: DocumentSnapshot | null;
}

export type FeedSort = 'latest' | 'popular';

export async function getPromptFeed(
  promptId: string,
  after?: DocumentSnapshot | null,
  sort: FeedSort = 'latest'
): Promise<FeedPage> {
  const sortField = sort === 'popular' ? 'likeCount' : 'createdAt';
  const constraints = [
    where('promptId', '==', promptId),
    orderBy(sortField, 'desc'),
    ...(after ? [startAfter(after)] : []),
    limit(FEED_PAGE_SIZE),
  ];
  const snap = await getDocs(query(collection(db, postsCol), ...constraints));
  return {
    posts: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
  };
}

export async function getUserPublicPosts(userId: string): Promise<Post[]> {
  const q = query(collection(db, postsCol), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
}

export async function deletePost(postId: string, writingId: string): Promise<void> {
  await deleteDoc(doc(db, postsCol, postId));
  await updateWritingVisibility(writingId, 'private');
  await linkWritingToPost(writingId, null);
}

export async function adjustLikeCount(postId: string, delta: 1 | -1): Promise<void> {
  await updateDoc(doc(db, postsCol, postId), { likeCount: increment(delta) });
}

export async function adjustCommentCount(postId: string, delta: 1 | -1): Promise<void> {
  await updateDoc(doc(db, postsCol, postId), { commentCount: increment(delta) });
}

export async function updatePostContent(postId: string, lines: string[]): Promise<void> {
  await updateDoc(doc(db, postsCol, postId), { lines: lines.filter((l) => l.trim().length > 0) });
}
