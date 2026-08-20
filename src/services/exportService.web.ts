import { Writing } from '../types/models';
import { buildExportText, buildExportJson } from './exportService.shared';

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
