import { Writing } from '../types/models';
import { buildExportText } from './exportService.shared';

export { buildExportText };

// 웹: OS 공유시트가 없으므로 텍스트 파일을 직접 다운로드시킨다.
export async function exportWritings(writings: Writing[]): Promise<void> {
  const text = buildExportText(writings);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saegim-export-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
