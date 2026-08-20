import { Share } from 'react-native';
import { Writing } from '../types/models';
import { buildExportText, buildExportJson } from './exportService.shared';

export { buildExportText, buildExportJson };

// 네이티브: OS 공유시트로 텍스트를 넘긴다(파일 시스템 권한 없이 가장 단순하게 동작).
export async function exportWritings(writings: Writing[]): Promise<void> {
  await Share.share({ message: buildExportText(writings) });
}

export async function exportWritingsJson(writings: Writing[]): Promise<void> {
  await Share.share({ message: buildExportJson(writings) });
}

// 네이티브에는 브라우저 인쇄 대화상자가 없다. 별도 PDF 라이브러리 없이는 안전하게
// 파일을 만들 수 없어, 같은 내용을 텍스트로 공유하는 기존 경로로 대신한다
// (이번 세션은 웹 배포만 검증 대상이라 네이티브 전용 폴백은 최소한으로 둔다).
export async function exportWritingsPdf(writings: Writing[]): Promise<void> {
  await exportWritings(writings);
}
