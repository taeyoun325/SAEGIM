import { useState } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../constants/theme';

// 코드 로그인으로 처음 들어온 사용자가 닉네임을 정하는 화면.
// user는 있지만 profile이 아직 없는 상태에서만 RootNavigator가 이 화면을 보여준다.
export default function ProfileSetupScreen() {
  const { completeCodeSignup, signOut } = useAuth();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await completeCodeSignup(nickname);
    } catch (e: any) {
      setError(e?.message || '닉네임 설정에 실패했어요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.logo}>새김</Text>
      <Text style={styles.intro}>환영해요! 앞으로 새김에서 쓸 닉네임을 정해주세요.</Text>
      <TextInput
        style={styles.input}
        placeholder="닉네임"
        placeholderTextColor={colors.textSoft}
        value={nickname}
        onChangeText={setNickname}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="시작하기"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>시작하기</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => signOut()} accessibilityRole="button" accessibilityLabel="다른 계정으로 로그인하기">
        <Text style={styles.link}>다른 계정으로 로그인하기</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.lg },
  logo: { fontSize: 32, fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: spacing.xl },
  intro: { color: colors.textSoft, fontSize: 14, textAlign: 'center', marginBottom: spacing.md, lineHeight: 20 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, marginBottom: spacing.sm },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: colors.textSoft, textAlign: 'center', marginTop: spacing.lg },
});
