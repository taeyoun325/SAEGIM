export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Profile: undefined;
  Today: undefined;
  Feed: undefined;
  Calendar: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  PostDetail: { postId: string };
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
  Character: undefined;
  Notifications: undefined;
};
