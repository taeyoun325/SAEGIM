import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, Platform, ScrollView } from 'react-native';
import Text from '../components/Text';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, REAUTH_REQUIRED } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { colors, spacing, radius, ThemePreference } from '../constants/theme';
import { loadThemePreference, saveThemePreference, canReloadForTheme, reloadForTheme } from '../services/themeService';
import { isReminderEnabled, enableDailyReminder, disableDailyReminder } from '../services/notificationService';
import { isAdmin } from '../services/adminService';
import { updateUserProfile } from '../services/userService';
import { PROMPT_CATEGORIES } from '../constants/promptPool';
import { RootStackParamList } from '../navigation/types';
import BackgroundMascot from '../components/BackgroundMascot';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const THEME_OPTIONS: { value: ThemePreference; label: string; emoji: string }[] = [
  { value: 'system', label: '기기 설정', emoji: '📱' },
  { value: 'light', label: '라이트', emoji: '☀️' },
  { value: 'dark', label: '다크', emoji: '🌙' },
];

export default function SettingsScreen() {
  const { user, profile, signOut, deleteAccount, refreshProfile } = useAuth();
  const { confirm, notify, prompt } = useDialog();
  const navigation = useNavigation<Nav>();
  const [reminderOn, setReminderOn] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');

  useEffect(() => {
    loadThemePreference().then(setThemePreference);
  }, []);

  async function changeTheme(next: ThemePreference) {
    if (next === themePreference) return;
    setThemePreference(next);
    await saveThemePreference(next);
    // 이미 만들어진 스타일에는 색이 구워져 있어 화면을 처음부터 다시 그려야 반영된다.
    if (canReloadForTheme) {
      reloadForTheme();
      return;
    }
    await notify('테마를 저장했어요', '앱을 다시 시작하면 새 테마로 열려요.');
  }

  async function togglePreferredCategory(category: string) {
    if (!user || !profile) return;
    const current = profile.preferredCategories ?? [];
    const next = current.includes(category) ? current.filter((c) => c !== category) : [...current, category];
    await updateUserProfile(user.uid, { preferredCategories: next });
    await refreshProfile();
  }

  useEffect(() => {
    isReminderEnabled().then(setReminderOn);
  }, []);

  // 관리자 메뉴는 admins 컬렉션에 등록된 계정에만 보인다.
  useEffect(() => {
    if (!user) return;
    isAdmin(user.uid).then(setAdmin);
  }, [user]);

  async function toggleReminder(next: boolean) {
    if (Platform.OS === 'web') {
      await notify('안내', '알림은 실제 기기(Android/iOS)에서 사용할 수 있어요.');
      return;
    }
    if (next) {
      const granted = await enableDailyReminder();
      if (!granted) {
        await notify('알림 권한이 필요해요', '기기 설정에서 알림 권한을 허용해주세요.');
        return;
      }
    } else {
      await disableDailyReminder();
    }
    setReminderOn(next);
  }

  async function confirmDeleteAccount() {
    const ok = await confirm({
      title: '계정을 삭제할까요?',
      message: '새긴 생각, 공개한 글, 댓글, 좋아요가 모두 삭제되며 되돌릴 수 없어요.',
      confirmLabel: '삭제하기',
      destructive: true,
    });
    if (!ok) return;

    try {
      await deleteAccount();
      return;
    } catch (e: any) {
      if (e?.message !== REAUTH_REQUIRED) {
        await notify('오류', '계정 삭제에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
    }

    // 마지막 로그인이 오래돼 Firebase가 삭제를 거부한 경우, 비밀번호로 본인 확인 후 재시도한다.
    const password = await prompt({
      title: '비밀번호를 확인해주세요',
      message: '보안을 위해 비밀번호를 다시 입력해주세요.',
      placeholder: '비밀번호',
      secure: true,
      confirmLabel: '삭제하기',
      destructive: true,
    });
    if (!password) return;

    try {
      await deleteAccount(password);
    } catch (e) {
      await notify('오류', '비밀번호가 올바르지 않거나 삭제에 실패했어요.');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>설정</Text>

      <View style={styles.card}>
        <View style={styles.reminderRow}>
          <Text style={styles.rowButtonText}>매일 저녁 8시 알림</Text>
          <Switch value={reminderOn} onValueChange={toggleReminder} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.categorySection}>
          <Text style={styles.rowButtonText}>화면 테마</Text>
          <Text style={styles.categoryHint}>
            {canReloadForTheme ? '고르면 바로 적용돼요.' : '고른 테마는 앱을 다시 시작할 때 적용돼요.'}
          </Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((option) => {
              const selected = themePreference === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.themeChip, selected && styles.themeChipSelected]}
                  onPress={() => changeTheme(option.value)}
                >
                  <Text style={styles.themeEmoji}>{option.emoji}</Text>
                  <Text style={[styles.themeChipText, selected && styles.themeChipTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.categorySection}>
          <Text style={styles.rowButtonText}>선호 글감 카테고리</Text>
          <Text style={styles.categoryHint}>나중에 맞춤 글감 추천에 활용돼요.</Text>
          <View style={styles.categoryRow}>
            {PROMPT_CATEGORIES.map((c) => {
              const selected = profile?.preferredCategories?.includes(c);
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                  onPress={() => togglePreferredCategory(c)}
                >
                  <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.rowButton} onPress={() => navigation.navigate('BlockedUsers')}>
          <Text style={styles.rowButtonText}>차단한 사용자 목록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rowButton, styles.rowButtonNoBorder]} onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Text style={styles.rowButtonText}>개인정보처리방침</Text>
        </TouchableOpacity>
      </View>

      {admin && (
        <View style={styles.card}>
          <TouchableOpacity style={styles.rowButton} onPress={() => navigation.navigate('AdminReports')}>
            <Text style={styles.adminText}>🛡️ 신고 관리 (관리자)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rowButton, styles.rowButtonNoBorder]}
            onPress={() => navigation.navigate('AdminDashboard')}
          >
            <Text style={styles.adminText}>📊 통계 대시보드 (관리자)</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <TouchableOpacity style={styles.rowButton} onPress={signOut}>
          <Text style={styles.rowButtonText}>로그아웃</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rowButton, styles.rowButtonNoBorder]} onPress={confirmDeleteAccount}>
          <Text style={styles.dangerText}>계정 삭제</Text>
        </TouchableOpacity>
      </View>
      <BackgroundMascot source={require('../assets/mascot-settings.png')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  rowButton: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowButtonNoBorder: { borderBottomWidth: 0 },
  rowButtonText: { color: colors.text, fontSize: 15 },
  adminText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  dangerText: { color: colors.danger, fontSize: 15 },
  categorySection: { paddingVertical: spacing.md },
  categoryHint: { color: colors.textSoft, fontSize: 12, marginTop: 2, marginBottom: spacing.sm },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  themeRow: { flexDirection: 'row', gap: spacing.sm },
  themeChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  themeChipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.primary },
  themeEmoji: { fontSize: 18 },
  themeChipText: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
  themeChipTextSelected: { color: colors.primary },
  categoryChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { color: colors.textSoft, fontSize: 13, fontWeight: '600' },
  categoryChipTextSelected: { color: '#fff' },
});
