import { View, StyleSheet } from 'react-native';
import Text from './Text';
import { colors, spacing, radius } from '../constants/theme';
import { CharacterProgress } from '../services/characterService';

interface Props {
  progress: CharacterProgress;
}

// 개발자 서버 모드 전용 실험 카드. 실제 서비스에 낼 완성 기능이 아니라,
// "글을 새김 = 캐릭터가 자란다"는 아이디어가 재미있는지 관리자 계정에서
// 먼저 눈으로 확인해보기 위한 스캐폴딩이다.
//
// TODO(다음 단계, 어려운 부분 — Opus 등에서 이어서):
// - 이모지 대신 실제 성장 단계별 스프라이트 이미지로 교체
//   (constants/characterGrowth.ts 상단에 조사해둔 CC0 무료 소스 참고)
// - 단계가 바뀌는 순간의 연출(배지 획득 모달처럼 축하 애니메이션)
// - 성장 임계값을 실사용 데이터로 재조정
// - 캐릭터를 눌러 상호작용하는 요소(먹이주기 등, Finch류 앱 참고)를 추가할지 결정
export default function CharacterGrowthCard({ progress }: Props) {
  const { stage, nextStage, writingCount, progressToNext } = progress;

  return (
    <View style={styles.card}>
      <Text style={styles.badge}>🧪 개발자 서버 모드 실험 · 캐릭터 육성</Text>
      <Text style={styles.emoji}>{stage.emoji}</Text>
      <Text style={styles.stageLabel}>{stage.label}</Text>
      <Text style={styles.description}>{stage.description}</Text>
      <Text style={styles.countText}>지금까지 새긴 생각 {writingCount}개</Text>
      {nextStage ? (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progressToNext * 100}%` }]} />
          </View>
          <Text style={styles.nextText}>
            다음 단계 {nextStage.emoji} {nextStage.label}까지 {Math.max(0, nextStage.minWritingCount - writingCount)}개
          </Text>
        </>
      ) : (
        <Text style={styles.nextText}>가장 자란 모습이에요.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  badge: { color: colors.textSoft, fontSize: 11, fontWeight: '700', marginBottom: spacing.sm },
  emoji: { fontSize: 56, marginBottom: spacing.xs },
  stageLabel: { fontSize: 18, fontWeight: '800', color: colors.primary },
  description: { color: colors.textSoft, fontSize: 12, marginTop: 2, marginBottom: spacing.sm, textAlign: 'center' },
  countText: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  track: { width: '100%', height: 8, borderRadius: radius.full, backgroundColor: colors.card, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  nextText: { color: colors.textSoft, fontSize: 12, marginTop: spacing.xs },
});
