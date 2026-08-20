import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Text from './Text';
import { colors, spacing, radius } from '../constants/theme';
import { CharacterProgress, canFeedToday, feedCharacter, getUnlockedAccessories, getNextLockedAccessory, equipAccessory } from '../services/characterService';
import { UserProfile } from '../types/models';

interface Props {
  progress: CharacterProgress;
  profile: Pick<UserProfile, 'characterAffection' | 'characterLastFedDate' | 'characterEquippedAccessoryId'>;
  uid: string;
  onChange: () => Promise<void>;
}

// 개발자 서버 모드 전용 실험 카드. 실제 서비스에 낼 완성 기능이 아니라,
// "글을 새김 = 캐릭터가 자란다"는 아이디어에 더해 매일 한 번 상호작용(먹이 주기)
// 하고 꾸밀 수 있게 해, 수동적인 진행률 표시를 넘어 실제 게임처럼 느껴지는지
// 관리자 계정에서 먼저 확인해보기 위한 스캐폴딩이다.
//
// TODO(다음 단계, 어려운 부분 — Opus 등에서 이어서):
// - 이모지 대신 실제 성장 단계별 스프라이트 이미지로 교체
//   (constants/characterGrowth.ts 상단에 조사해둔 CC0 무료 소스 참고)
// - 단계가 바뀌는 순간의 연출(배지 획득 모달처럼 축하 애니메이션), 먹이 주기 리액션 연출
// - 성장 임계값 및 애정도 해금 임계값을 실사용 데이터로 재조정
export default function CharacterGrowthCard({ progress, profile, uid, onChange }: Props) {
  const { stage, nextStage, writingCount, progressToNext } = progress;
  const [feeding, setFeeding] = useState(false);
  const [equipping, setEquipping] = useState<string | null>(null);

  const affection = profile.characterAffection ?? 0;
  const canFeed = canFeedToday(profile);
  const equippedId = profile.characterEquippedAccessoryId ?? 'none';
  const unlocked = getUnlockedAccessories(affection);
  const nextLocked = getNextLockedAccessory(affection);
  const equippedAccessory = unlocked.find((a) => a.id === equippedId);

  async function handleFeed() {
    if (!canFeed || feeding) return;
    setFeeding(true);
    try {
      await feedCharacter(uid, profile);
      await onChange();
    } finally {
      setFeeding(false);
    }
  }

  async function handleEquip(accessoryId: string) {
    if (equipping || accessoryId === equippedId) return;
    setEquipping(accessoryId);
    try {
      await equipAccessory(uid, accessoryId);
      await onChange();
    } finally {
      setEquipping(null);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.badge}>🧪 개발자 서버 모드 실험 · 캐릭터 육성</Text>
      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{stage.emoji}</Text>
        {equippedAccessory?.emoji ? <Text style={styles.accessoryOverlay}>{equippedAccessory.emoji}</Text> : null}
      </View>
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

      <View style={styles.divider} />

      <Text style={styles.affectionText}>❤️ 애정도 {affection}</Text>
      <TouchableOpacity
        style={[styles.feedButton, !canFeed && styles.feedButtonDisabled]}
        onPress={handleFeed}
        disabled={!canFeed || feeding}
        accessibilityRole="button"
        accessibilityLabel={canFeed ? '먹이 주기' : '오늘은 이미 먹이를 줬어요'}
      >
        <Text style={styles.feedButtonText}>{canFeed ? '🍚 먹이 주기' : '오늘은 이미 밥을 줬어요'}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>꾸미기</Text>
      <View style={styles.accessoryRow}>
        {unlocked.map((a) => {
          const selected = a.id === equippedId;
          return (
            <TouchableOpacity
              key={a.id}
              style={[styles.accessoryChip, selected && styles.accessoryChipSelected]}
              onPress={() => handleEquip(a.id)}
              disabled={equipping !== null}
              accessibilityRole="button"
              accessibilityLabel={`${a.label} 장착${selected ? ', 선택됨' : ''}`}
              aria-selected={selected}
            >
              <Text style={styles.accessoryChipEmoji}>{a.emoji || '🚫'}</Text>
              <Text style={[styles.accessoryChipLabel, selected && styles.accessoryChipLabelSelected]}>{a.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {nextLocked && (
        <Text style={styles.lockedHint}>
          🔒 애정도 {nextLocked.minAffection}에서 {nextLocked.label} 해금
        </Text>
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
  emojiWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emoji: { fontSize: 56 },
  accessoryOverlay: { position: 'absolute', top: -6, right: -10, fontSize: 26 },
  stageLabel: { fontSize: 18, fontWeight: '800', color: colors.primary },
  description: { color: colors.textSoft, fontSize: 12, marginTop: 2, marginBottom: spacing.sm, textAlign: 'center' },
  countText: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  track: { width: '100%', height: 8, borderRadius: radius.full, backgroundColor: colors.card, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  nextText: { color: colors.textSoft, fontSize: 12, marginTop: spacing.xs },
  divider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  affectionText: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  feedButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  feedButtonDisabled: { backgroundColor: colors.border },
  feedButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sectionLabel: { color: colors.textSoft, fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', marginBottom: spacing.xs },
  accessoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  accessoryChip: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 64,
  },
  accessoryChipSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  accessoryChipEmoji: { fontSize: 20 },
  accessoryChipLabel: { fontSize: 11, color: colors.textSoft, marginTop: 2 },
  accessoryChipLabelSelected: { color: colors.primary, fontWeight: '700' },
  lockedHint: { color: colors.textSoft, fontSize: 11, marginTop: spacing.sm },
});
