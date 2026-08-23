export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Profile: undefined;
  Character: undefined;
  Today: undefined;
  Feed: undefined;
  Calendar: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  // focusComments: 목록에서 글을 탭해 들어온 경우처럼 댓글부터 보고 싶을 때 true.
  // 글 본문은 목록 카드에서 이미 읽었으므로, 열자마자 댓글 위치로 스크롤한다.
  PostDetail: { postId: string; focusComments?: boolean };
  OtherProfile: { userId: string };
  Report: { targetType: 'post' | 'comment'; targetId: string };
  BlockedUsers: undefined;
  MyReports: undefined;
  PrivacyPolicy: undefined;
  CommunityGuidelines: undefined;
  AdminReports: undefined;
  AdminDashboard: undefined;
  Settings: undefined;
  MyWritings: undefined;
  SavedPosts: undefined;
  PracticeWriting: undefined;
  Notifications: undefined;
};
