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
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  PostDetail: { postId: string };
  OtherProfile: { userId: string };
  Report: { targetType: 'post' | 'comment'; targetId: string };
  BlockedUsers: undefined;
  PrivacyPolicy: undefined;
};
