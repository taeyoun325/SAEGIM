import { Writing } from '../types/models';
import { buildExportText, buildExportJson, buildExportHtml } from './exportService.shared';

export { buildExportText, buildExportJson };

function downloadFile(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 웹: OS 공유시트가 없으므로 파일을 직접 다운로드시킨다.
export async function exportWritings(writings: Writing[]): Promise<void> {
  downloadFile(buildExportText(writings), 'text/plain;charset=utf-8', `saegim-export-${Date.now()}.txt`);
}

export async function exportWritingsJson(writings: Writing[]): Promise<void> {
  downloadFile(buildExportJson(writings), 'application/json;charset=utf-8', `saegim-export-${Date.now()}.json`);
}

// 새 탭에 인쇄 전용 문서를 열고 브라우저의 인쇄 대화상자를 띄운다.
// 사용자가 "PDF로 저장"을 고르면 별도 변환 없이 그대로 PDF가 된다.
export async function exportWritingsPdf(writings: Writing[]): Promise<void> {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return; // 팝업이 막혔으면 조용히 포기한다(다른 내보내기 방법이 있으므로).
  printWindow.document.write(buildExportHtml(writings));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
