import { Writing } from '../types/models';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

// 프라이버시 신뢰 관점에서 자료조사 결과, 저널링 앱 사용자들이 가장 자주 불만을 제기하는
// 지점 중 하나가 "내 글을 못 꺼낸다"는 것이었다. 언제든 내 데이터를 통째로 가져갈 수
// 있다는 확신이 오히려 장기적으로 계속 쓰게 만드는 신뢰 요인이 된다.
export function buildExportText(writings: Writing[]): string {
  const sorted = [...writings].sort((a, b) => a.createdAt - b.createdAt);
  const header = [
    '새김 — 내가 새긴 생각 내보내기',
    `내보낸 날짜: ${formatDisplayDate(timestampToDateString(Date.now()))}`,
    `총 ${sorted.length}개`,
    '',
  ].join('\n');

  const body = sorted
    .map((w) => {
      const date = formatDisplayDate(timestampToDateString(w.createdAt));
      const visibility = w.visibility === 'public' ? '공개' : '비공개';
      return [`====================`, `${date} (${visibility})`, ...w.lines].join('\n');
    })
    .join('\n\n');

  return `${header}\n${body}\n`;
}

// 다른 저널링 앱으로 옮기거나 스크립트로 다시 읽어들이기 쉽도록 구조화된 형식도 함께
// 제공한다(텍스트 내보내기는 읽기 좋지만 프로그램으로 재조립하기는 어렵다).
// uid/문서 id 등 내부 식별자는 다른 서비스로 옮길 때 의미가 없어 제외하고,
// 실제 콘텐츠와 메타데이터(기분, 즐겨찾기, 공개 여부, 글감 카테고리)만 담는다.
export function buildExportJson(writings: Writing[]): string {
  const sorted = [...writings].sort((a, b) => a.createdAt - b.createdAt);
  const entries = sorted.map((w) => ({
    date: timestampToDateString(w.createdAt),
    lines: w.lines,
    visibility: w.visibility,
    category: w.category ?? null,
    mood: w.mood ?? null,
    favorited: !!w.favorited,
  }));
  return JSON.stringify({ app: '새김', exportedAt: new Date().toISOString(), count: entries.length, entries }, null, 2);
}
