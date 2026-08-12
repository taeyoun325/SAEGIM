import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, Platform, ScrollView } from 'react-native';
import Text from '../components/Text';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, REAUTH_REQUIRED } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { colors, spacing, radius } from '../constants/theme';
import { isReminderEnabled, enableDailyReminder, disableDailyReminder } from '../services/notificationService';
import { isAdmin } from '../services/adminService';
import { RootStackParamList } from '../navigation/types';
import BackgroundMascot from '../components/BackgroundMascot';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const { confirm, notify, prompt } = useDialog();
  const navigation = useNavigation<Nav>();
  const [reminderOn, setReminderOn] = useState(false);
  const [admin, setAdmin] = useState(false);

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
        <TouchableOpacity style={styles.rowButton} onPress={() => navigation.navigate('BlockedUsers')}>
          <Text style={styles.rowButtonText}>차단한 사용자 목록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rowButton, styles.rowButtonNoBorder]} onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Text style={styles.rowButtonText}>개인정보처리방침</Text>
        </TouchableOpacity>
      </View>

      {admin && (
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.rowButton, styles.rowButtonNoBorder]}
            onPress={() => navigation.navigate('AdminReports')}
          >
            <Text style={styles.adminText}>🛡️ 신고 관리 (관리자)</Text>
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
});
