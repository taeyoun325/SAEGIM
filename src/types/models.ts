export type Visibility = 'private' | 'public';

export interface DailyPrompt {
  id: string; // e.g. "20260812"
  date: string; // "2026-08-12"
  title: string;
  category: string;
  createdAt: number;
}

export interface Writing {
  id: string;
  userId: string;
  promptId: string;
  lines: string[]; // 1~3줄
  createdAt: number;
  updatedAt: number;
  visibility: Visibility;
  postId?: string | null;
}

export interface Post {
  id: string;
  writingId: string;
  userId: string;
  promptId: string;
  lines: string[];
  createdAt: number;
  likeCount: number;
  commentCount: number;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  authorNickname: string;
  content: string;
  createdAt: number;
}

export interface Like {
  id: string; // `${postId}_${userId}`
  postId: string;
  userId: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  nickname: string;
  photoURL?: string | null;
  createdAt: number;
  writingCount: number;
  publicPostCount: number;
  streakCount: number;
  lastWritingDate?: string | null;
  blockedUserIds: string[];
  earnedBadgeIds: string[];
}

export type ReportReason = 'spam' | 'abuse' | 'inappropriate' | 'ad' | 'other';
export type ReportTargetType = 'post' | 'comment';

export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reporterId: string;
  reason: ReportReason;
  detail?: string;
  createdAt: number;
  status: 'pending' | 'reviewed' | 'dismissed';
}

// 관리자 통계용 일별 집계 카운터. 원문 콘텐츠는 담지 않고 개수/uid만 담아
// 관리자가 사용자의 비공개 글 내용을 열람하지 않아도 지표를 볼 수 있게 한다.
export interface DailyStats {
  date: string; // "2026-08-17"
  newSignups: number;
  writingsCount: number;
  activeUserIds: string[];
  commentsCount: number;
  likesCount: number;
}
