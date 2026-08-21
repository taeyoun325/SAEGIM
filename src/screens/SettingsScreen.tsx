import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, Platform, ScrollView, Text as RNText } from 'react-native';
import Text from '../components/Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, REAUTH_REQUIRED } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { colors, spacing, radius, fonts, FontScalePreference, FONT_SCALE_VALUES } from '../constants/theme';
import { useFontScale } from '../context/FontScaleContext';
import {
  isReminderEnabled,
  enableDailyReminder,
  disableDailyReminder,
  getReminderTime,
  changeReminderTime,
  ReminderTime,
} from '../services/notificationService';
import { isAdmin } from '../services/adminService';
import { isAppLockEnabled, setAppLockPin, disableAppLock, isValidPin } from '../services/appLockService';
import {
  updateUserProfile,
  muteNotificationType,
  unmuteNotificationType,
} from '../services/userService';
import { GUEST_EMAIL_DOMAIN, MONTHLY_GOAL_OPTIONS } from '../constants/config';
import { NotificationType } from '../types/models';
import { RootStackParamList } from '../navigation/types';
import BackgroundMascot from '../components/BackgroundMascot';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FONT_SCALE_OPTIONS: { value: FontScalePreference; label: string }[] = [
  { value: 'small', label: '작게' },
  { value: 'medium', label: '보통' },
  { value: 'large', label: '크게' },
];

// 사람마다 하루를 정리하는 시간이 다르니 몇 가지 대표적인 시간대만 고를 수 있게 한다.
// 분 단위 커스텀 입력은 이 정도 알림 기능치고 과한 선택지라 대표 시간대로 좁혔다.
// 신고 처리 결과 알림(report_resolved/report_dismissed)은 운영 조치를 알리는
// 필수 정보라 여기 포함하지 않는다 — 사용자가 끌 수 있는 건 활동 알림뿐이다.
const NOTIFICATION_TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'post_like', label: '내 글에 좋아요' },
  { value: 'post_comment', label: '내 글에 댓글' },
  { value: 'comment_like', label: '내 댓글에 좋아요' },
  { value: 'comment_reply', label: '내 댓글에 답글' },
  { value: 'comment_mention', label: '댓글에서 나를 언급' },
];

const REMINDER_TIME_OPTIONS: { hour: number; minute: number; label: string }[] = [
  { hour: 9, minute: 0, label: '오전 9시' },
  { hour: 12, minute: 0, label: '낮 12시' },
  { hour: 18, minute: 0, label: '오후 6시' },
  { hour: 20, minute: 0, label: '오후 8시' },
  { hour: 22, minute: 0, label: '오후 10시' },
];

export default function SettingsScreen() {
  const {
    user,
    profile,
    signOut,
    deleteAccount,
    changePassword,
    changeEmail,
    refreshProfile,
    emailVerified,
    resendVerificationEmail,
    refreshEmailVerified,
  } = useAuth();
  const { confirm, notify, prompt } = useDialog();
  const navigation = useNavigation<Nav>();
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderTime, setReminderTimeState] = useState<ReminderTime>({ hour: 20, minute: 0 });
  const [admin, setAdmin] = useState(false);
  const { preference: fontScalePreference, setPreference: setFontScalePreference } = useFontScale();
  const [resendingVerification, setResendingVerification] = useState(false);
  const [appLockOn, setAppLockOn] = useState(false);
  const isGuestAccount = !!user?.email?.endsWith(GUEST_EMAIL_DOMAIN);

  useEffect(() => {
    isAppLockEnabled().then(setAppLockOn);
  }, []);

  // 메일함에서 인증 링크를 누르고 이 화면으로 돌아왔을 때 배너가 알아서 사라지도록,
  // 화면에 포커스될 때마다 최신 인증 상태를 다시 받아온다.
  useFocusEffect(
    useCallback(() => {
      refreshEmailVerified();
    }, [refreshEmailVerified])
  );

  async function handleResendVerification() {
    setResendingVerification(true);
    try {
      await resendVerificationEmail();
      await notify('메일을 보냈어요', '받은 편지함(스팸함 포함)에서 인증 링크를 확인해주세요.');
    } catch (e: any) {
      if (e?.code === 'auth/too-many-requests') {
        await notify('오류', '잠시 후 다시 시도해주세요.');
      } else {
        await notify('오류', '인증 메일을 보내지 못했어요.');
      }
    } finally {
      setResendingVerification(false);
    }
  }

  async function handleSetMonthlyGoal(value: number | null) {
    if (!user) return;
    await updateUserProfile(user.uid, { monthlyGoal: value });
    await refreshProfile();
  }

  // PIN을 설정하거나 바꿀 때 쓰는 공용 흐름. 로그인 자체는 그대로 유지한 채
  // 기기 로컬에만 저장되는 값이라 실패해도 계정에 영향이 없다.
  async function promptForNewPin(): Promise<void> {
    const pin = await prompt({
      title: appLockOn ? 'PIN 변경' : '앱 잠금 PIN 설정',
      message: '앱을 다시 열 때마다 입력할 숫자 4~6자리를 정해주세요.',
      placeholder: '숫자 4~6자리',
      confirmLabel: '설정',
      secure: true,
    });
    if (pin === null) return;
    if (!isValidPin(pin)) {
      await notify('오류', 'PIN은 숫자 4~6자리로 입력해주세요.');
      return;
    }
    await setAppLockPin(pin);
    setAppLockOn(true);
    await notify('설정했어요', '다음에 앱을 열 때부터 이 PIN을 입력해야 해요.');
  }

  async function handleToggleAppLock(next: boolean) {
    if (next) {
      await promptForNewPin();
    } else {
      await disableAppLock();
      setAppLockOn(false);
    }
  }

  async function toggleNotificationType(type: NotificationType, currentlyOn: boolean) {
    if (!user) return;
    if (currentlyOn) {
      await muteNotificationType(user.uid, type);
    } else {
      await unmuteNotificationType(user.uid, type);
    }
    await refreshProfile();
  }

  useEffect(() => {
    isReminderEnabled().then(setReminderOn);
    getReminderTime().then(setReminderTimeState);
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

  async function selectReminderTime(time: ReminderTime) {
    if (time.hour === reminderTime.hour && time.minute === reminderTime.minute) return;
    setReminderTimeState(time);
    await changeReminderTime(time);
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

  async function handleChangePassword() {
    const currentPassword = await prompt({
      title: '비밀번호 변경',
      message: '보안을 위해 현재 비밀번호를 입력해주세요.',
      placeholder: '현재 비밀번호',
      secure: true,
      confirmLabel: '다음',
    });
    if (!currentPassword) return;

    const newPassword = await prompt({
      title: '새 비밀번호',
      message: '6자 이상으로 입력해주세요.',
      placeholder: '새 비밀번호',
      secure: true,
      confirmLabel: '변경하기',
    });
    if (!newPassword) return;
    if (newPassword.length < 6) {
      await notify('오류', '비밀번호는 6자 이상이어야 해요.');
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      await notify('변경했어요', '비밀번호가 안전하게 변경됐어요.');
    } catch (e: any) {
      if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        await notify('오류', '현재 비밀번호가 올바르지 않아요.');
      } else {
        await notify('오류', '비밀번호 변경에 실패했어요.');
      }
    }
  }

  async function handleChangeEmail() {
    const currentPassword = await prompt({
      title: '이메일 변경',
      message: '보안을 위해 현재 비밀번호를 입력해주세요.',
      placeholder: '현재 비밀번호',
      secure: true,
      confirmLabel: '다음',
    });
    if (!currentPassword) return;

    const newEmail = await prompt({
      title: '새 이메일',
      message: '새로 사용할 이메일 주소를 입력해주세요.',
      placeholder: '새 이메일',
      confirmLabel: '인증 메일 보내기',
    });
    if (!newEmail || !newEmail.trim()) return;

    try {
      await changeEmail(currentPassword, newEmail.trim());
      await notify(
        '인증 메일을 보냈어요',
        '새 이메일 주소로 확인 메일을 보냈어요. 메일함의 링크를 눌러야 변경이 완료돼요.'
      );
    } catch (e: any) {
      if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        await notify('오류', '현재 비밀번호가 올바르지 않아요.');
      } else if (e?.code === 'auth/invalid-email') {
        await notify('오류', '이메일 형식을 확인해주세요.');
      } else if (e?.code === 'auth/email-already-in-use') {
        await notify('오류', '이미 사용 중인 이메일이에요.');
      } else {
        await notify('오류', '이메일 변경에 실패했어요.');
      }
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>설정</Text>

      <View style={styles.card}>
        <View style={styles.reminderRow}>
          <Text style={styles.rowButtonText}>매일 글감 알림</Text>
          <Switch value={reminderOn} onValueChange={toggleReminder} />
        </View>
        {reminderOn && Platform.OS !== 'web' && (
          <View style={styles.reminderTimeSection}>
            <Text style={styles.categoryHint}>알림 시간</Text>
            <View style={styles.categoryRow}>
              {REMINDER_TIME_OPTIONS.map((opt) => {
                const selected = opt.hour === reminderTime.hour && opt.minute === reminderTime.minute;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                    onPress={() => selectReminderTime(opt)}
                    accessibilityRole="button"
                    accessibilityLabel={`알림 시간 ${opt.label}`}
                    aria-selected={selected}
                  >
                    <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.categorySection}>
          <Text style={styles.rowButtonText}>알림 종류</Text>
          <Text style={styles.categoryHint}>끄고 싶은 활동 알림만 골라서 끌 수 있어요.</Text>
          {NOTIFICATION_TYPE_OPTIONS.map((opt) => {
            const on = !profile?.mutedNotificationTypes?.includes(opt.value);
            return (
              <View key={opt.value} style={styles.notifTypeRow}>
                <Text style={styles.rowButtonText}>{opt.label}</Text>
                <Switch value={on} onValueChange={() => toggleNotificationType(opt.value, on)} />
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.categorySection}>
          <Text style={styles.rowButtonText}>글자 크기</Text>
          <Text style={styles.categoryHint}>고르면 바로 적용돼요.</Text>
          <View style={styles.themeRow}>
            {FONT_SCALE_OPTIONS.map((option) => {
              const selected = fontScalePreference === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.themeChip, selected && styles.themeChipSelected]}
                  onPress={() => setFontScalePreference(option.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`글자 크기 ${option.label}`}
                  aria-selected={selected}
                >
                  {/* 미리보기 글자는 지금 선택된 배율의 영향을 받으면 안 되므로
                      배율을 자동 적용하는 components/Text가 아니라 RN 원본 Text를 쓴다. */}
                  <RNText
                    style={[
                      styles.fontScalePreviewText,
                      { fontSize: 16 * FONT_SCALE_VALUES[option.value] },
                      selected && styles.themeChipTextSelected,
                    ]}
                  >
                    가
                  </RNText>
                  <Text style={[styles.themeChipText, selected && styles.themeChipTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.categorySection}>
          <Text style={styles.rowButtonText}>이번 달 목표</Text>
          <Text style={styles.categoryHint}>이번 달에 며칠 새기고 싶은지 골라두면 진행률을 보여줘요.</Text>
          <View style={styles.themeRow}>
            <TouchableOpacity
              style={[styles.themeChip, !profile?.monthlyGoal && styles.themeChipSelected]}
              onPress={() => handleSetMonthlyGoal(null)}
              accessibilityRole="button"
              accessibilityLabel="이번 달 목표 안 함"
              aria-selected={!profile?.monthlyGoal}
            >
              <Text style={[styles.themeChipText, !profile?.monthlyGoal && styles.themeChipTextSelected]}>안 함</Text>
            </TouchableOpacity>
            {MONTHLY_GOAL_OPTIONS.map((days) => {
              const selected = profile?.monthlyGoal === days;
              return (
                <TouchableOpacity
                  key={days}
                  style={[styles.themeChip, selected && styles.themeChipSelected]}
                  onPress={() => handleSetMonthlyGoal(days)}
                  accessibilityRole="button"
                  accessibilityLabel={`이번 달 목표 ${days}일`}
                  aria-selected={selected}
                >
                  <Text style={[styles.themeChipText, selected && styles.themeChipTextSelected]}>{days}일</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.reminderRow}>
          <Text style={styles.rowButtonText}>앱 잠금 (PIN)</Text>
          <Switch value={appLockOn} onValueChange={handleToggleAppLock} />
        </View>
        <Text style={styles.categoryHint}>
          {appLockOn
            ? '앱을 다시 열 때마다 PIN을 입력해야 해요. PIN을 잊으면 로그아웃 후 다시 로그인하면 돼요.'
            : '켜두면 앱을 다시 열 때마다 PIN을 입력해야 해요 — 잠깐 자리를 비워도 비공개 글이 바로 보이지 않아요.'}
        </Text>
        {appLockOn && (
          <TouchableOpacity
            onPress={promptForNewPin}
            style={styles.appLockChangeLink}
            accessibilityRole="button"
            accessibilityLabel="PIN 변경"
          >
            <Text style={styles.appLockChangeLinkText}>PIN 변경</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.rowButton}
          onPress={() => navigation.navigate('BlockedUsers')}
          accessibilityRole="button"
          accessibilityLabel="차단한 사용자 목록"
        >
          <Text style={styles.rowButtonText}>차단한 사용자 목록</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rowButton}
          onPress={() => navigation.navigate('MyReports')}
          accessibilityRole="button"
          accessibilityLabel="내 신고 내역"
        >
          <Text style={styles.rowButtonText}>내 신고 내역</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rowButton}
          onPress={() => navigation.navigate('CommunityGuidelines')}
          accessibilityRole="button"
          accessibilityLabel="커뮤니티 가이드라인"
        >
          <Text style={styles.rowButtonText}>커뮤니티 가이드라인</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rowButton, styles.rowButtonNoBorder]}
          onPress={() => navigation.navigate('PrivacyPolicy')}
          accessibilityRole="button"
          accessibilityLabel="개인정보처리방침"
        >
          <Text style={styles.rowButtonText}>개인정보처리방침</Text>
        </TouchableOpacity>
      </View>

      {admin && (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.rowButton}
            onPress={() => navigation.navigate('AdminReports')}
            accessibilityRole="button"
            accessibilityLabel="신고 관리, 관리자"
          >
            <Text style={styles.adminText}>🛡️ 신고 관리 (관리자)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rowButton, styles.rowButtonNoBorder]}
            onPress={() => navigation.navigate('AdminDashboard')}
            accessibilityRole="button"
            accessibilityLabel="통계 대시보드, 관리자"
          >
            <Text style={styles.adminText}>📊 통계 대시보드 (관리자)</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isGuestAccount && !emailVerified && (
        <View style={styles.verifyBanner}>
          <Text style={styles.verifyBannerText}>이메일 인증이 아직 안 됐어요. 비밀번호를 잊었을 때 재설정 메일을 받으려면 인증이 필요해요.</Text>
          <TouchableOpacity
            onPress={handleResendVerification}
            disabled={resendingVerification}
            accessibilityRole="button"
            accessibilityLabel="인증 메일 재전송"
          >
            <Text style={styles.verifyBannerLink}>{resendingVerification ? '보내는 중...' : '인증 메일 재전송'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.rowButton}
          onPress={handleChangeEmail}
          accessibilityRole="button"
          accessibilityLabel="이메일 변경"
        >
          <Text style={styles.rowButtonText}>이메일 변경</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rowButton}
          onPress={handleChangePassword}
          accessibilityRole="button"
          accessibilityLabel="비밀번호 변경"
        >
          <Text style={styles.rowButtonText}>비밀번호 변경</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rowButton} onPress={signOut} accessibilityRole="button" accessibilityLabel="로그아웃">
          <Text style={styles.rowButtonText}>로그아웃</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rowButton, styles.rowButtonNoBorder]}
          onPress={confirmDeleteAccount}
          accessibilityRole="button"
          accessibilityLabel="계정 삭제"
        >
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
  reminderTimeSection: { paddingBottom: spacing.md },
  appLockChangeLink: { marginTop: spacing.sm },
  appLockChangeLinkText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  rowButton: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowButtonNoBorder: { borderBottomWidth: 0 },
  rowButtonText: { color: colors.text, fontSize: 15 },
  adminText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  dangerText: { color: colors.danger, fontSize: 15 },
  verifyBanner: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  verifyBannerText: { color: colors.text, fontSize: 13, lineHeight: 19, marginBottom: spacing.xs },
  verifyBannerLink: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  categorySection: { paddingVertical: spacing.md },
  notifTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
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
  fontScalePreviewText: { fontFamily: fonts.regular, color: colors.textSoft },
  themeChipText: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
  themeChipTextSelected: { color: colors.primary },
  categoryChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { color: colors.textSoft, fontSize: 13, fontWeight: '600' },
  categoryChipTextSelected: { color: '#fff' },
  mutedChip: {
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  mutedChipText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  addMutedChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addMutedChipText: { color: colors.textSoft, fontSize: 13, fontWeight: '600' },
});
