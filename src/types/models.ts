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
  category?: string; // 글감 카테고리(개인 통계용 비정규화)
  deletedAt?: number | null; // 비공개 글을 지우면 바로 없애지 않고 휴지통 기간(30일) 동안 이 값만 채운다
  mood?: string | null; // 글을 쓸 때 남긴 기분 이모지(선택). MOOD_OPTIONS 중 하나.
  favorited?: boolean; // "내 새김 관리"에서 즐겨찾기로 표시해 빠르게 다시 찾을 수 있게 한다.
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
  category?: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  authorNickname: string;
  content: string;
  createdAt: number;
  likeCount?: number;
  parentCommentId?: string | null; // 답글이면 원댓글 id, 최상위 댓글이면 null
  editedAt?: number | null; // 본문을 수정한 적이 있으면 그 시각
}

export interface CommentLike {
  id: string; // `${commentId}_${userId}`
  commentId: string;
  postId: string;
  userId: string;
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
  bio?: string | null;
  bestStreak: number;
  streakFreezes?: number; // 하루 빠져도 연속 기록을 지켜주는 보호권
  mutedNotificationTypes?: NotificationType[]; // 이 종류의 알림은 아예 만들지 않는다(알림 피로 방지)
  monthlyGoal?: number | null; // 이번 달에 새기고 싶은 날짜 수(선택). 설정하지 않으면 진행률을 보여주지 않는다.
  // 캐릭터 육성 필드.
  characterSpeciesId?: string | null; // 고른 알(종). null이면 아직 알을 고르지 않은 상태.
  characterStageOverride?: number | null; // "부화/진화" 버튼으로 밝혀 보여준 단계(0부터). 실제 writingCount로 계산한 단계를 넘어설 수 없다.
  characterAffection?: number; // 먹이 주기로 쌓이는 애정도
  characterLastFedDate?: string | null; // 하루 한 번 제한용 (YYYY-MM-DD)
  characterEquippedAccessoryId?: string | null;
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

export type NotificationType =
  | 'post_like'
  | 'post_comment'
  | 'comment_like'
  | 'comment_reply'
  | 'comment_mention' // 댓글 안에서 "@닉네임"으로 다른 사람을 언급했다
  | 'report_resolved' // 내가 신고한 콘텐츠가 검토돼 삭제됐다
  | 'report_dismissed' // 내가 신고한 콘텐츠를 검토했지만 문제없다고 판단했다
  | 'content_removed'; // 내가 올린 콘텐츠가 신고 처리로 삭제됐다(글쓴이 본인에게 가는 알림)

// 인앱 알림함(활동 알림). OS 푸시가 아니라 앱을 열었을 때 종 아이콘으로 확인하는 방식.
// (Cloud Functions/FCM 서버가 없어 실시간 푸시는 불가능 — Firestore 문서 읽기로만 구현한다.)
export interface AppNotification {
  id: string;
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId: string;
  commentId?: string | null;
  createdAt: number;
  read: boolean;
}

// 일회용 로그인 코드: 이메일이 없는 사용자(예: 학생)에게 5자리 숫자 코드만 나눠주고
// 그 코드가 곧 계정 아이디+비밀번호 역할을 하게 한다. Admin SDK로만 생성되며,
// 클라이언트는 이 문서를 코드로 직접 조회(get)해서 로그인 정보를 얻는다 — list는 막혀 있어
// 코드를 순회로 알아낼 수 없다.
export interface LoginCode {
  email: string;
  password: string;
  claimed: boolean;
  uid: string | null;
  createdAt: number;
}

// 관리자 통계용 일별 집계 카운터. 원문 콘텐츠는 담지 않고 개수/uid만 담아
// 관리자가 사용자의 비공개 글 내용을 열람하지 않아도 지표를 볼 수 있게 한다.
export interface DailyStats {
  date: string; // "2026-08-17"
  newSignups: number;
  writingsCount: number;
  activeUserIds: string[]; // 그날 글을 쓴 사용자
  commentsCount: number;
  likesCount: number;
  openUserIds?: string[]; // 그날 앱을 연 사용자(실제 DAU 기준)
  events?: Record<string, number>; // 퍼널 이벤트 카운터
}
