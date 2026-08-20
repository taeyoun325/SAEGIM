// 앱 전역 설정값. 글자 수 제한 등은 여기서만 변경한다.

export const WRITING_LINE_COUNT = 3;
export const WRITING_TOTAL_MAX_LENGTH = 120; // 전체 최대 글자 수 (줄바꿈 포함)
export const WRITING_MIN_LINES_REQUIRED = 1; // 최소 작성 줄 수

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 12;

export const FEED_PAGE_SIZE = 10;
export const COMMENT_PAGE_SIZE = 20;

export const COMMENT_MAX_LENGTH = 200;

export const REPORT_MAX_PER_USER_PER_TARGET = 1;

export const BLOCKED_NICKNAME_WORDS = ['admin', '운영자', '관리자', 'saegim', '새김'];

// 코드 로그인 계정에 scripts/issue-login-codes.js가 부여하는 가짜 이메일 도메인.
// 실제로 받을 수 있는 주소가 아니므로 이메일 인증 안내를 이 도메인 계정에는 보여주지 않는다.
export const GUEST_EMAIL_DOMAIN = '@saegim-guest.local';
