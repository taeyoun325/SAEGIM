// 글감 예비 풀(fallback pool).
//
// Firestore에 해당 날짜의 글감 문서가 없을 때 이 목록에서 날짜 기반으로 하나를 골라 쓴다.
// 날짜만으로 결정되므로 서버 없이도 모든 사용자가 같은 날 같은 글감을 보게 된다.
// (Spark 무료 요금제라 Cloud Functions로 매일 생성할 수 없어 이 방식을 쓴다.)
//
// ⚠️ 중요: 이 배열의 순서를 바꾸거나 중간에 항목을 끼워 넣으면 과거 날짜의 글감이 달라진다.
// 새 글감은 반드시 배열 "맨 끝"에만 추가한다.
export interface PromptSeed {
  title: string;
  category: string;
}

// PROMPT_POOL에 실제로 쓰인 카테고리 전체 목록(선호 카테고리 선택, 관리자 글감 추가 폼에서 재사용).
export const PROMPT_CATEGORIES = ['관계', '자아', '감정', '계절', '가치', '상황', '질문'];

export const PROMPT_POOL: PromptSeed[] = [
  { title: '우정', category: '관계' },
  { title: '가족', category: '관계' },
  { title: '꿈', category: '자아' },
  { title: '후회', category: '감정' },
  { title: '여름', category: '계절' },
  { title: '행복', category: '감정' },
  { title: '성공', category: '자아' },
  { title: '실패', category: '자아' },
  { title: '자유', category: '가치' },
  { title: '용기', category: '가치' },
  { title: '10년 후의 나', category: '상황' },
  { title: '다시 돌아가고 싶은 순간', category: '상황' },
  { title: '가장 기억에 남는 하루', category: '상황' },
  { title: '처음 만난 사람', category: '상황' },
  { title: '잊고 싶은 기억', category: '상황' },
  { title: '내가 가장 고마웠던 사람', category: '상황' },
  { title: '행복이란 무엇일까?', category: '질문' },
  { title: '친구란 무엇일까?', category: '질문' },
  { title: '성공했다고 느끼는 순간은 언제일까?', category: '질문' },
  { title: '위로', category: '감정' },
  { title: '설렘', category: '감정' },
  { title: '외로움', category: '감정' },
  { title: '기다림', category: '감정' },
  { title: '변화', category: '가치' },
  { title: '습관', category: '자아' },
  { title: '취향', category: '자아' },
  { title: '겨울', category: '계절' },
  { title: '봄', category: '계절' },
  { title: '가을', category: '계절' },
  { title: '비 오는 날', category: '계절' },
  { title: '오늘 가장 고마웠던 일', category: '상황' },
  { title: '나를 웃게 한 것', category: '상황' },
  { title: '요즘 자주 듣는 노래', category: '상황' },
  { title: '어릴 때 살던 동네', category: '상황' },
  { title: '나에게 쓰는 편지', category: '상황' },
  { title: '가장 오래된 기억', category: '상황' },
  { title: '나만 아는 작은 행복', category: '상황' },
  { title: '어른이 된다는 건', category: '질문' },
  { title: '좋은 사람이란 무엇일까?', category: '질문' },
  { title: '지금 나에게 필요한 건?', category: '질문' },
  { title: '용서', category: '가치' },
  { title: '정직', category: '가치' },
  { title: '노력', category: '가치' },
  { title: '쉼', category: '가치' },
  { title: '내가 지키고 싶은 약속', category: '상황' },
  { title: '누군가에게 배운 것', category: '상황' },
  { title: '아직 하지 못한 말', category: '상황' },
  { title: '가장 좋아하는 계절과 이유', category: '질문' },
  { title: '시간', category: '가치' },
  { title: '거리', category: '관계' },
];
