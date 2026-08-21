import { useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import TopBarButtons from '../components/TopBarButtons';
import { CHARACTER_SPECIES, findSpecies, getSpeciesProgress, selectCharacterSpecies, resetCharacter, feedCharacter, evolveCharacter, getUnlockedAccessories, getNextLockedAccessory, equipAccessory, canFeedToday, getObtainedSpeciesIds } from '../services/characterService';

type CharacterTab = 'raise' | 'dex';

// "새김"을 계속할수록 함께 자라는 캐릭터. 프로필-오늘 탭 사이에 탭으로 노출된다.
export default function CharacterScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { confirm, notify } = useDialog();
  const [busy, setBusy] = useState(false);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CharacterTab>('raise');

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
    } catch (e: any) {
      await notify('오류', e?.message || '알을 고르지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFeed() {
    if (!user || !profile || busy || !canFeedToday(profile)) return;
    setBusy(true);
    try {
      await feedCharacter(user.uid, profile);
      await refreshProfile();
    } catch (e: any) {
      await notify('오류', e?.message || '먹이를 주지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEvolve() {
    if (!user || !profile || !species || busy) return;
    setBusy(true);
    try {
      await evolveCharacter(user.uid, profile, species);
      await refreshProfile();
    } catch (e: any) {
      await notify('오류', e?.message || '진화시키지 못했어요.');
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
    } catch (e: any) {
      await notify('오류', e?.message || '장착하지 못했어요.');
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
    } catch (e: any) {
      await notify('오류', e?.message || '초기화하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  const progress = species ? getSpeciesProgress(profile, species) : null;
  const affection = profile.characterAffection ?? 0;
  const equippedId = profile.characterEquippedAccessoryId ?? 'none';
  const unlocked = getUnlockedAccessories(affection);
  const nextLocked = getNextLockedAccessory(affection);
  const equippedAccessory = unlocked.find((a) => a.id === equippedId);
  const canFeed = canFeedToday(profile);
  const evolveLabel =
    progress && progress.stageIndex === 0 ? '🥚 부화시키기' : `${progress?.nextStage?.emoji ?? '✨'} 진화시키기`;
  const obtainedIds = getObtainedSpeciesIds(profile);

  return (
    <View style={{ flex: 1 }}>
      <TopBarButtons />
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'raise' && styles.tabActive]}
          onPress={() => setActiveTab('raise')}
          accessibilityRole="button"
          accessibilityLabel="키우기 보기"
          aria-selected={activeTab === 'raise'}
        >
          <Text style={[styles.tabText, activeTab === 'raise' && styles.tabTextActive]}>키우기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dex' && styles.tabActive]}
          onPress={() => setActiveTab('dex')}
          accessibilityRole="button"
          accessibilityLabel="도감 보기"
          aria-selected={activeTab === 'dex'}
        >
          <Text style={[styles.tabText, activeTab === 'dex' && styles.tabTextActive]}>
            도감 {obtainedIds.length}/{CHARACTER_SPECIES.length}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'dex' ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Text style={styles.pickHint}>글을 새기며 캐릭터를 끝까지 키우면 도감에 기록돼요.</Text>
          <View style={styles.dexGrid}>
            {CHARACTER_SPECIES.map((s) => {
              const obtained = obtainedIds.includes(s.id);
              const finalStage = s.stages[s.stages.length - 1];
              return (
                <View key={s.id} style={styles.dexCard}>
                  <View style={styles.dexSpriteFrame}>
                    {finalStage.sprite ? (
                      <Image
                        source={finalStage.sprite}
                        style={[styles.dexSprite, !obtained && styles.dexSpriteSilhouette]}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.dexEmoji}>{obtained ? finalStage.emoji : '❔'}</Text>
                    )}
                  </View>
                  <Text style={styles.dexName}>{obtained ? finalStage.label : '???'}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : !species ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.badge}>{species.eggName} 라인</Text>

      <View style={styles.emojiWrap}>
        {progress!.stage.sprite ? (
          <View style={styles.spriteFrame}>
            <Image source={progress!.stage.sprite} style={styles.spriteImage} resizeMode="contain" />
            {equippedAccessory?.emoji && progress!.stage.accessoryAnchor ? (
              <Text
                style={[
                  styles.accessoryOnHead,
                  {
                    left: `${progress!.stage.accessoryAnchor[0]}%`,
                    top: `${progress!.stage.accessoryAnchor[1]}%`,
                  },
                ]}
              >
                {equippedAccessory.emoji}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.emoji}>{progress!.stage.emoji}</Text>
            {equippedAccessory?.emoji ? <Text style={styles.accessoryOverlay}>{equippedAccessory.emoji}</Text> : null}
          </>
        )}
      </View>
      <Text style={styles.stageLabel}>{progress!.stage.label}</Text>
      <Text style={styles.countText}>지금까지 새긴 생각 {progress!.writingCount}개</Text>
      {progress!.nextStage ? (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress!.progressToNext * 100}%` }]} />
          </View>
          <Text style={styles.nextText}>
            다음 단계 {progress!.nextStage.emoji} {progress!.nextStage.label}까지{' '}
            {Math.max(0, progress!.nextStage.minWritingCount - progress!.writingCount)}개
          </Text>
        </>
      ) : (
        <Text style={styles.nextText}>가장 자란 모습이에요.</Text>
      )}
      {progress!.readyToEvolve && (
        <TouchableOpacity
          style={styles.evolveButton}
          onPress={handleEvolve}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${evolveLabel}, 다음 모습으로 자랄 준비가 됐어요`}
        >
          <Text style={styles.evolveButtonText}>{evolveLabel}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.divider} />

      <Text style={styles.affectionText}>❤️ 애정도 {affection}</Text>
      <TouchableOpacity
        style={[styles.feedButton, !canFeed && styles.feedButtonDisabled]}
        onPress={handleFeed}
        disabled={busy || !canFeed}
        accessibilityRole="button"
        accessibilityLabel={canFeed ? '먹이 주기' : '먹이 주기, 오늘은 이미 줬어요'}
      >
        <Text style={styles.feedButtonText}>{canFeed ? '🍚 먹이 주기' : '🍚 오늘은 다 줬어요'}</Text>
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' },
  tabRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSoft, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  dexGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  dexCard: {
    width: 100,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  dexSpriteFrame: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  dexSprite: { width: 64, height: 64 },
  dexSpriteSilhouette: { tintColor: '#000000', opacity: 0.55 },
  dexEmoji: { fontSize: 36, opacity: 0.55 },
  dexName: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: spacing.xs, textAlign: 'center' },
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
  spriteFrame: { width: 120, height: 120, position: 'relative' },
  spriteImage: { width: 120, height: 120 },
  accessoryOverlay: { position: 'absolute', top: -8, right: -14, fontSize: 30 },
  // 스프라이트마다 다른 머리 위치(accessoryAnchor, 0~100% 좌표)에 얹는다.
  // transform으로 중앙 정렬해 anchor 자체가 "머리 중심"을 가리키게 한다.
  accessoryOnHead: { position: 'absolute', fontSize: 26, transform: [{ translateX: -13 }, { translateY: -20 }] },
  stageLabel: { fontSize: 20, fontWeight: '800', color: colors.primary },
  countText: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.sm },
  track: { width: '100%', maxWidth: 320, height: 8, borderRadius: radius.full, backgroundColor: colors.card, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  nextText: { color: colors.textSoft, fontSize: 12, marginTop: spacing.xs },
  evolveButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  evolveButtonText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  divider: { width: '100%', maxWidth: 320, height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  affectionText: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  feedButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  feedButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  feedButtonDisabled: { backgroundColor: colors.border },
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
