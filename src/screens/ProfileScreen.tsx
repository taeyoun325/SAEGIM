import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Text from '../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { colors, spacing, radius } from '../constants/theme';
import { Post, Writing } from '../types/models';
import { getUserPublicPosts } from '../services/postService';
import { getCurrentMonthWritingDayCount, getMyWritings } from '../services/writingService';
import { updateUserProfile, syncUserCounts } from '../services/userService';
import { isAdmin } from '../services/adminService';
import { isDevModeEnabled } from '../services/devModeService';
import { uploadProfileImage } from '../services/storageService';
import { evaluateAndAwardBadges } from '../services/badgeService';
import { BADGE_DEFS, BadgeDef } from '../constants/badges';
import PostCard from '../components/PostCard';
import BackgroundMascot from '../components/BackgroundMascot';
import TopBarButtons from '../components/TopBarButtons';
import BadgeCelebrationModal from '../components/BadgeCelebrationModal';
import { useLikedPosts } from '../hooks/useLikedPosts';
import { RootStackParamList } from '../navigation/types';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { prompt, notify } = useDialog();
  const navigation = useNavigation<Nav>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [myWritings, setMyWritings] = useState<Writing[]>([]);
  const [activeTab, setActiveTab] = useState<'written' | 'public'>('public');
  const likedPostIds = useLikedPosts(posts, user?.uid);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [celebrationBadge, setCelebrationBadge] = useState<BadgeDef | null>(null);
  const [monthDayCount, setMonthDayCount] = useState(0);
  // 개발자 서버 모드 실험 카드(캐릭터 육성) 노출 여부. 두 조건을 모두 만족해야 보인다
  // (관리자 계정 + 설정에서 스위치를 켬) — SettingsScreen의 admin 가드와 짝을 이룬다.
  const [showCharacterExperiment, setShowCharacterExperiment] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [adminAccount, devMode] = await Promise.all([isAdmin(user.uid), isDevModeEnabled()]);
      setShowCharacterExperiment(adminAccount && devMode);
    })();
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [list] = await Promise.all([
        getUserPublicPosts(user.uid),
        getMyWritings(user.uid).then(setMyWritings),
      ]);
      setPosts(list);

      if (profile?.monthlyGoal) {
        setMonthDayCount(await getCurrentMonthWritingDayCount(user.uid));
      }

      if (profile) {
        // 화면에 보이는 개수가 실제 내 글 수와 항상 같도록 맞춘다.
        // (값이 이미 맞으면 같은 객체를 그대로 돌려주므로 불필요한 갱신이 없다.)
        const synced = await syncUserCounts(user.uid, profile);
        if (synced !== profile) await refreshProfile();

        const totalLikes = list.reduce((sum, p) => sum + p.likeCount, 0);
        const { newBadges } = await evaluateAndAwardBadges(user.uid, profile, totalLikes);
        if (newBadges.length > 0) {
          await refreshProfile();
          setCelebrationBadge(newBadges[0]);
        }
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.earnedBadgeIds, profile?.monthlyGoal]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePickImage() {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await notify('권한이 필요해요', '사진 접근 권한을 허용해주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const url = await uploadProfileImage(user.uid, result.assets[0].uri);
      await updateUserProfile(user.uid, { photoURL: url });
      await refreshProfile();
    } catch (e) {
      await notify('오류', '프로필 사진 업로드에 실패했어요.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleEditBio() {
    if (!user) return;
    const next = await prompt({
      title: '자기소개',
      placeholder: '나를 한 줄로 소개해보세요',
      confirmLabel: '저장',
    });
    if (next === null) return;
    try {
      await updateUserProfile(user.uid, { bio: next.trim() || null });
      await refreshProfile();
    } catch (e) {
      await notify('오류', '자기소개 저장에 실패했어요.');
    }
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TopBarButtons />
      <FlatList<Post | Writing>
      style={styles.container}
      data={activeTab === 'public' ? posts : myWritings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {showCharacterExperiment && (
              <TouchableOpacity
                style={styles.characterEntryButton}
                onPress={() => navigation.navigate('Character')}
                accessibilityRole="button"
                accessibilityLabel="캐릭터 육성 실험 열기"
              >
                <Text style={styles.characterEntryButtonText}>
                  🧪 캐릭터 육성 {profile?.characterSpeciesId ? '보러가기' : '시작하기'}
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.identityRow}>
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={uploadingPhoto}
                style={styles.avatarWrap}
                accessibilityRole="button"
                accessibilityLabel="프로필 사진 바꾸기"
              >
                {profile.photoURL ? (
                  <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{profile.nickname.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  {uploadingPhoto ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.avatarBadgeText}>📷</Text>}
                </View>
              </TouchableOpacity>
              <View style={styles.identityText}>
                <Text style={styles.nickname}>{profile.nickname}</Text>
                <Text style={styles.joined}>가입일 {formatDisplayDate(timestampToDateString(profile.createdAt))}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleEditBio}
              style={styles.bioRow}
              accessibilityRole="button"
              accessibilityLabel={profile.bio ? `자기소개 수정, 현재: ${profile.bio}` : '자기소개 추가하기'}
            >
              <Text style={profile.bio ? styles.bioText : styles.bioPlaceholder} numberOfLines={2}>
                {profile.bio || '자기소개를 추가해보세요'}
              </Text>
            </TouchableOpacity>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.writingCount}</Text>
                <Text style={styles.statLabel}>새긴 생각</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.publicPostCount}</Text>
                <Text style={styles.statLabel}>공개한 생각</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>🔥 {profile.streakCount}</Text>
                <Text style={styles.statLabel}>연속 새김</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>🏅 {profile.bestStreak ?? 0}</Text>
                <Text style={styles.statLabel}>최고 기록</Text>
              </View>
            </View>

            <Text style={styles.freezeNote}>
              🧊 연속 기록 보호권 {profile.streakFreezes ?? 0}개 — 하루를 걸러도 스트릭이 안 끊겨요. 스트릭 배지를 딸 때마다 하나씩 생겨요.
            </Text>

            {profile.monthlyGoal && (
              <View style={styles.goalSection}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalLabel}>이번 달 목표</Text>
                  <Text style={styles.goalValue}>{monthDayCount}/{profile.monthlyGoal}일</Text>
                </View>
                <View style={styles.goalTrack}>
                  <View
                    style={[
                      styles.goalFill,
                      { width: `${Math.min(100, (monthDayCount / profile.monthlyGoal) * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            )}

            <View style={styles.linkRow}>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => navigation.navigate('MyWritings')}
                accessibilityRole="button"
                accessibilityLabel="내 새김 관리"
              >
                <Text style={styles.linkButtonText}>📖 내 새김 관리</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => navigation.navigate('SavedPosts')}
                accessibilityRole="button"
                accessibilityLabel="저장한 글"
              >
                <Text style={styles.linkButtonText}>🔖 저장한 글</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>배지</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
              {BADGE_DEFS.map((b) => {
                const owned = profile.earnedBadgeIds?.includes(b.id);
                return (
                  <View key={b.id} style={[styles.badgeChip, !owned && styles.badgeChipLocked]}>
                    <Text style={[styles.badgeEmoji, !owned && styles.badgeEmojiLocked]}>{b.emoji}</Text>
                    <Text style={[styles.badgeName, !owned && styles.badgeNameLocked]}>{b.name}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.postTabRow}>
              <TouchableOpacity
                style={[styles.postTab, activeTab === 'written' && styles.postTabActive]}
                onPress={() => setActiveTab('written')}
                accessibilityRole="button"
                accessibilityLabel="새긴 생각 보기"
                aria-selected={activeTab === 'written'}
              >
                <Text style={[styles.postTabText, activeTab === 'written' && styles.postTabTextActive]}>
                  새긴 생각 {profile.writingCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postTab, activeTab === 'public' && styles.postTabActive]}
                onPress={() => setActiveTab('public')}
                accessibilityRole="button"
                accessibilityLabel="공개한 생각 보기"
                aria-selected={activeTab === 'public'}
              >
                <Text style={[styles.postTabText, activeTab === 'public' && styles.postTabTextActive]}>
                  공개한 생각 {profile.publicPostCount}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {activeTab === 'written' ? '아직 새긴 생각이 없어요.' : '아직 공개한 생각이 없어요.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          'likeCount' in item ? (
            <PostCard
              post={item}
              liked={likedPostIds.has(item.id)}
              onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            />
          ) : (
            <WrittenRow
              writing={item}
              onPress={item.postId ? () => navigation.navigate('PostDetail', { postId: item.postId! }) : undefined}
            />
          )
        }
        ListFooterComponent={<BackgroundMascot source={require('../assets/mascot-profile.png')} />}
      />
      <BadgeCelebrationModal badge={celebrationBadge} onClose={() => setCelebrationBadge(null)} />
    </View>
  );
}

// "새긴 생각" 탭 전용 행. PostCard는 좋아요/댓글 수 등 공개 게시물에만 있는 정보를
// 전제로 하고 있어 재사용하지 않고, 비공개 글도 자연스럽게 보이는 가벼운 행을 따로 둔다.
function WrittenRow({ writing, onPress }: { writing: Writing; onPress?: () => void }) {
  const isPublic = writing.visibility === 'public';
  return (
    <TouchableOpacity
      style={styles.writtenRow}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${writing.lines.join(' ')}, 눌러서 게시물 보기` : undefined}
    >
      <View style={styles.writtenRowHeader}>
        <Text style={styles.writtenRowDate}>
          {formatDisplayDate(timestampToDateString(writing.createdAt))}
          {writing.mood ? ` ${writing.mood}` : ''}
        </Text>
        <Text style={isPublic ? styles.writtenRowPublicBadge : styles.writtenRowPrivateBadge}>
          {isPublic ? '🌐 공개' : '🔒 비공개'}
        </Text>
      </View>
      <Text style={styles.writtenRowPreview} numberOfLines={2}>
        {writing.lines.join(' · ')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { paddingTop: spacing.lg },
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 24, fontWeight: '800', color: colors.primary },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarBadgeText: { fontSize: 11 },
  identityText: { marginLeft: spacing.md, flex: 1 },
  nickname: { fontSize: 24, fontWeight: '800', color: colors.primary },
  joined: { color: colors.textSoft, marginTop: spacing.xs },
  bioRow: { marginTop: spacing.md },
  bioText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  bioPlaceholder: { color: colors.textSoft, fontSize: 14, fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', marginTop: spacing.lg, marginBottom: spacing.lg },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { color: colors.textSoft, fontSize: 12, marginTop: spacing.xs },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: spacing.sm, marginBottom: spacing.sm },
  characterEntryButton: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  characterEntryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  postTabRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  postTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  postTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  postTabText: { color: colors.textSoft, fontSize: 13, fontWeight: '700' },
  postTabTextActive: { color: '#fff' },
  writtenRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  writtenRowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  writtenRowDate: { color: colors.textSoft, fontSize: 12 },
  writtenRowPublicBadge: { color: colors.success, fontSize: 12, fontWeight: '600' },
  writtenRowPrivateBadge: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
  writtenRowPreview: { color: colors.text, fontSize: 15, lineHeight: 22 },
  freezeNote: { color: colors.textSoft, fontSize: 11, lineHeight: 16, marginBottom: spacing.md },
  goalSection: { marginBottom: spacing.md },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  goalLabel: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
  goalValue: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  goalTrack: { height: 6, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  linkRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  linkButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  linkButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  badgeRow: { gap: spacing.sm, paddingBottom: spacing.md },
  badgeChip: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 76,
  },
  badgeChipLocked: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  badgeEmoji: { fontSize: 24 },
  badgeEmojiLocked: { opacity: 0.3 },
  badgeName: { fontSize: 11, color: colors.primary, marginTop: spacing.xs, textAlign: 'center' },
  badgeNameLocked: { color: colors.textSoft },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textSoft },
});
