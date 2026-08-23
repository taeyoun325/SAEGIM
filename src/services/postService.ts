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
  writeBatch,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Post, Writing } from '../types/models';
import { linkWritingToPost, updateWritingVisibility, unlinkWritingFromPost } from './writingService';
import { FEED_PAGE_SIZE } from '../constants/config';

const postsCol = 'posts';

// 특정 필드=값 조건의 문서를 전부 지운다. Firestore 배치는 한 번에 최대 500개까지 처리한다.
export async function deleteDocsWhere(collectionName: string, field: string, value: string): Promise<number> {
  const snap = await getDocs(query(collection(db, collectionName), where(field, '==', value)));
  if (snap.empty) return 0;
  const chunks: (typeof snap.docs)[] = [];
  for (let i = 0; i < snap.docs.length; i += 450) chunks.push(snap.docs.slice(i, i + 450));
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

// 게시물과 연결된 댓글/댓글좋아요/좋아요/저장/알림을 함께 지운다.
// 게시물 삭제(본인/관리자) 경로에서 공용으로 쓴다.
//
// ⚠️ 반드시 게시물 문서를 먼저 지운 뒤에 호출해야 한다. 이 문서들은 남이 만든 것이라
// 평소엔 본인만 지울 수 있고, 보안 규칙이 "글이 이미 사라졌을 때만" 남의 것 정리를
// 허용하기 때문이다(firestore.rules의 postGone 참고). 순서를 바꾸면 좋아요·댓글이
// 달린 글은 삭제가 권한 오류로 실패한다.
export async function deletePostRelatedContent(postId: string): Promise<void> {
  // 댓글은 개별 문서 id가 있어야 그 댓글에 달린 좋아요를 지울 수 있으므로 먼저 조회한다.
  const commentsSnap = await getDocs(query(collection(db, 'comments'), where('postId', '==', postId)));
  for (const c of commentsSnap.docs) {
    await deleteDocsWhere('commentLikes', 'commentId', c.id);
  }
  await deleteDocsWhere('comments', 'postId', postId);
  await deleteDocsWhere('likes', 'postId', postId);
  await deleteDocsWhere('saves', 'postId', postId);
  await deleteDocsWhere('notifications', 'postId', postId);
}

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
    ...(writing.category ? { category: writing.category } : {}),
  } satisfies Omit<Post, 'id'>);
  await updateWritingVisibility(writing.id, 'public');
  await linkWritingToPost(writing.id, postRef.id);
  return postRef.id;
}

// 공개 취소. 게시물 문서가 사라지면 거기 달렸던 좋아요/댓글/저장/알림은 가리킬 대상이
// 없어지므로 함께 정리한다 — 남겨두면 보안 규칙상 누구도 지울 수 없는 고아 데이터가 된다
// (딸린 문서 삭제 권한이 "그 글의 주인"인지로 판정되는데, 글이 이미 없으면 판정 자체가 불가).
// 반드시 게시물보다 먼저 지워야 하는 이유도 같다.
export async function unpublishPost(postId: string, writingId: string): Promise<void> {
  await deleteDoc(doc(db, postsCol, postId));
  await deletePostRelatedContent(postId);
  await unlinkWritingFromPost(writingId);
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
  await deletePostRelatedContent(postId);
  await unlinkWritingFromPost(writingId);
}

// 글을 원본까지 완전히 삭제한다.
// deletePost는 "공개만 취소"라 원본 글(writings 문서)을 비공개로 남기지만,
// 사용자가 "내 새김 관리"에서 삭제를 누른 건 기록 자체를 지우겠다는 뜻이므로
// 게시물·딸린 콘텐츠·원본 글을 한 번에 지운다.
export async function deleteWritingCompletely(writingId: string, postId: string | null): Promise<void> {
  if (postId) {
    await deleteDoc(doc(db, postsCol, postId));
    await deletePostRelatedContent(postId);
  }
  await deleteDoc(doc(db, 'writings', writingId));
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
