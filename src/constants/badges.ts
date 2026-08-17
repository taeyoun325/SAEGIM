export type BadgeType = 'streak' | 'writing' | 'likes';

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  description: string;
  type: BadgeType;
  threshold: number;
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: 'streak_3', emoji: '🔥', name: '3일 연속', description: '3일 연속으로 생각을 새겼어요', type: 'streak', threshold: 3 },
  { id: 'streak_7', emoji: '🔥', name: '7일 연속', description: '7일 연속으로 생각을 새겼어요', type: 'streak', threshold: 7 },
  { id: 'streak_15', emoji: '🔥', name: '15일 연속', description: '15일 연속으로 생각을 새겼어요', type: 'streak', threshold: 15 },
  { id: 'streak_30', emoji: '🔥', name: '30일 연속', description: '30일 연속으로 생각을 새겼어요', type: 'streak', threshold: 30 },
  { id: 'streak_50', emoji: '🔥', name: '50일 연속', description: '50일 연속으로 생각을 새겼어요', type: 'streak', threshold: 50 },
  { id: 'streak_100', emoji: '🔥', name: '100일 연속', description: '100일 연속으로 생각을 새겼어요', type: 'streak', threshold: 100 },
  { id: 'writing_1', emoji: '🌱', name: '첫 새김', description: '첫 생각을 새겼어요', type: 'writing', threshold: 1 },
  { id: 'writing_10', emoji: '📖', name: '10회 새김', description: '생각을 10번 새겼어요', type: 'writing', threshold: 10 },
  { id: 'writing_30', emoji: '📚', name: '30회 새김', description: '생각을 30번 새겼어요', type: 'writing', threshold: 30 },
  { id: 'writing_100', emoji: '🏆', name: '100회 새김', description: '생각을 100번 새겼어요', type: 'writing', threshold: 100 },
  { id: 'likes_1', emoji: '💛', name: '첫 공감', description: '내 글이 처음 좋아요를 받았어요', type: 'likes', threshold: 1 },
  { id: 'likes_10', emoji: '⭐', name: '인기 새김', description: '내 글이 좋아요 10개를 받았어요', type: 'likes', threshold: 10 },
  { id: 'likes_50', emoji: '🌟', name: '사랑받는 새김', description: '내 글이 좋아요 50개를 받았어요', type: 'likes', threshold: 50 },
  { id: 'likes_100', emoji: '👑', name: '새김의 왕', description: '내 글이 좋아요 100개를 받았어요', type: 'likes', threshold: 100 },
];
