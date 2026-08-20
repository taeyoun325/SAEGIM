import { useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { CHARACTER_SPECIES, findSpecies, getSpeciesProgress, selectCharacterSpecies, resetCharacter, feedCharacter, getUnlockedAccessories, getNextLockedAccessory, equipAccessory } from '../services/characterService';

// 개발자 서버 모드 전용 캐릭터 육성 화면. 프로필의 "🐣 캐릭터 육성" 버튼으로 들어온다.
// 이 화면 자체가 관리자 + 개발자 모드에서만 라우팅되므로(ProfileScreen 가드),
// 여기서는 먹이 주기를 하루 제한 없이 무제한으로 허용하고 언제든 알을 다시 고를 수
// 있게 한다 — 실사용자에게 낼 기능이 아니라 "글쓰기로 캐릭터가 자란다"는 아이디어
// 자체를 눈으로 빠르게 확인해보기 위한 실험 공간이기 때문이다.
export default function CharacterScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [equipping, setEquipping] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  if (!user || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const species = findSpecies(profile.characterSpeciesId);

  async function handleSelectSpecies(speciesId: string, name: string) {
    if (!user || busy) return;
    const ok = await confirm({
      title: `${name}(으)로 키울까요?`,
      message: '한 번 고르면 그 알부터 자라기 시작해요. 언제든 아래에서 다시 초기화할 수 있어요.',
      confirmLabel: '이 알로 시작',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await selectCharacterSpecies(user.uid, speciesId);
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  }

  async function handleFeed() {
    if (!user || !profile || busy) return;
    setBusy(true);
    try {
      await feedCharacter(user.uid, profile, { unlimited: true });
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  }

  async function handleEquip(accessoryId: string) {
    if (!user || equipping) return;
    setEquipping(accessoryId);
    try {
      await equipAccessory(user.uid, accessoryId);
      await refreshProfile();
    } finally {
      setEquipping(null);
    }
  }

  async function handleReset() {
    if (!user || busy) return;
    const ok = await confirm({
      title: '캐릭터를 초기화할까요?',
      message: '지금 키우던 알/캐릭터가 사라지고 처음부터 다른 알을 고를 수 있어요. 새긴 생각 개수 자체는 그대로예요.',
      confirmLabel: '초기화',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await resetCharacter(user.uid);
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  }

  if (!species) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.badge}>🧪 개발자 서버 모드 실험</Text>
        <Text style={styles.pickTitle}>키울 알을 골라주세요</Text>
        <Text style={styles.pickHint}>알마다 깨어나는 모습도, 다 자란 모습도 완전히 달라요.</Text>
        <View style={styles.eggGrid}>
          {CHARACTER_SPECIES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.eggCard}
              onPress={() => handleSelectSpecies(s.id, s.eggName)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`${s.eggName} 고르기, ${s.eggHint}`}
            >
              <Text style={styles.eggEmoji}>{s.eggEmoji}</Text>
              <Text style={styles.eggName}>{s.eggName}</Text>
              <Text style={styles.eggHint}>{s.eggHint}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  const progress = getSpeciesProgress(profile, species);
  const affection = profile.characterAffection ?? 0;
  const equippedId = profile.characterEquippedAccessoryId ?? 'none';
  const unlocked = getUnlockedAccessories(affection);
  const nextLocked = getNextLockedAccessory(affection);
  const equippedAccessory = unlocked.find((a) => a.id === equippedId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.badge}>🧪 개발자 서버 모드 실험 · {species.eggName} 라인</Text>

      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{progress.stage.emoji}</Text>
        {equippedAccessory?.emoji ? <Text style={styles.accessoryOverlay}>{equippedAccessory.emoji}</Text> : null}
      </View>
      <Text style={styles.stageLabel}>{progress.stage.label}</Text>
      <Text style={styles.countText}>지금까지 새긴 생각 {progress.writingCount}개</Text>
      {progress.nextStage ? (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress.progressToNext * 100}%` }]} />
          </View>
          <Text style={styles.nextText}>
            다음 단계 {progress.nextStage.emoji} {progress.nextStage.label}까지{' '}
            {Math.max(0, progress.nextStage.minWritingCount - progress.writingCount)}개
          </Text>
        </>
      ) : (
        <Text style={styles.nextText}>가장 자란 모습이에요.</Text>
      )}

      <View style={styles.divider} />

      <Text style={styles.affectionText}>❤️ 애정도 {affection}</Text>
      <TouchableOpacity
        style={styles.feedButton}
        onPress={handleFeed}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="먹이 주기, 개발자 모드라 무제한"
      >
        <Text style={styles.feedButtonText}>🍚 먹이 주기 (무제한)</Text>
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

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.resetButton}
        onPress={handleReset}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="캐릭터 초기화, 다른 알 고르기"
      >
        <Text style={styles.resetButtonText}>🔄 다른 알로 초기화</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' },
  badge: { color: colors.textSoft, fontSize: 11, fontWeight: '700', marginBottom: spacing.md, textAlign: 'center' },
  pickTitle: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: spacing.xs },
  pickHint: { color: colors.textSoft, fontSize: 13, marginBottom: spacing.lg, textAlign: 'center' },
  eggGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  eggCard: {
    width: 140,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  eggEmoji: { fontSize: 40, marginBottom: spacing.xs },
  eggName: { fontSize: 14, fontWeight: '700', color: colors.primary },
  eggHint: { fontSize: 11, color: colors.textSoft, marginTop: 2, textAlign: 'center' },
  emojiWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emoji: { fontSize: 64 },
  accessoryOverlay: { position: 'absolute', top: -8, right: -14, fontSize: 30 },
  stageLabel: { fontSize: 20, fontWeight: '800', color: colors.primary },
  countText: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.sm },
  track: { width: '100%', maxWidth: 320, height: 8, borderRadius: radius.full, backgroundColor: colors.card, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  nextText: { color: colors.textSoft, fontSize: 12, marginTop: spacing.xs },
  divider: { width: '100%', maxWidth: 320, height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  affectionText: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  feedButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  feedButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sectionLabel: { color: colors.textSoft, fontSize: 12, fontWeight: '700', alignSelf: 'center', marginTop: spacing.lg, marginBottom: spacing.xs },
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
  resetButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  resetButtonText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});
