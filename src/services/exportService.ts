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
