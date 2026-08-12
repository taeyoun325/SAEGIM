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
