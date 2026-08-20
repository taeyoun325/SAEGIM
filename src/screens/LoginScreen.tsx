import { useState } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { colors, spacing, radius } from '../constants/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signIn, resetPassword, loginWithCode } = useAuth();
  const { prompt, notify } = useDialog();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이메일이 없는 사용자(예: 학생)를 위한 5자리 코드 로그인 모드.
  // 코드 로그인이 처음이면(닉네임 미설정) RootNavigator가 알아서 ProfileSetupScreen으로
  // 넘겨주므로, 이 화면은 로그인 시도만 하고 그 이후는 신경 쓰지 않는다.
  const [mode, setMode] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError('로그인에 실패했어요. 이메일과 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeLogin() {
    setError(null);
    if (!/^\d{5}$/.test(code.trim())) {
      setError('5자리 숫자 코드를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await loginWithCode(code.trim());
    } catch (e) {
      setError('유효하지 않은 코드예요. 코드를 다시 확인해주세요.');
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const inputEmail = await prompt({
      title: '비밀번호 재설정',
      message: '가입하신 이메일 주소를 입력해주세요.',
      placeholder: '이메일',
      confirmLabel: '재설정 메일 보내기',
    });
    if (!inputEmail || !inputEmail.trim()) return;
    try {
      await resetPassword(inputEmail.trim());
    } catch (e: any) {
      if (e?.code === 'auth/invalid-email') {
        await notify('오류', '이메일 형식을 확인해주세요.');
        return;
      }
      // auth/user-not-found 등 그 외 오류는 가입 여부를 알려주는 셈이 되므로
      // 성공했을 때와 같은 안내를 그대로 보여준다(이메일 열거 공격 방지).
    }
    await notify(
      '메일을 보냈어요',
      '입력하신 이메일로 가입된 계정이 있다면 비밀번호 재설정 링크를 보내드렸어요. 받은 편지함(스팸함 포함)을 확인해주세요.'
    );
  }

  if (mode === 'code') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.logo}>새김</Text>
        <TextInput
          style={styles.input}
          placeholder="5자리 코드"
          placeholderTextColor={colors.textSoft}
          keyboardType="number-pad"
          maxLength={5}
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity
          style={styles.button}
          onPress={handleCodeLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="코드로 로그인"
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>로그인</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setMode('email');
            setError(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="이메일로 로그인하기"
        >
          <Text style={styles.link}>이메일로 로그인하기</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.logo}>새김</Text>
      <TextInput
        style={styles.input}
        placeholder="이메일"
        placeholderTextColor={colors.textSoft}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        placeholderTextColor={colors.textSoft}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        onPress={handleForgotPassword}
        style={styles.forgotRow}
        accessibilityRole="button"
        accessibilityLabel="비밀번호를 잊으셨나요"
      >
        <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="로그인"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>로그인</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('SignUp')}
        accessibilityRole="button"
        accessibilityLabel="계정이 없으신가요, 회원가입"
      >
        <Text style={styles.link}>계정이 없으신가요? 회원가입</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setMode('code');
          setError(null);
        }}
        accessibilityRole="button"
        accessibilityLabel="코드가 있으신가요, 코드로 로그인"
      >
        <Text style={styles.link}>코드가 있으신가요? 코드로 로그인</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.lg },
  logo: { fontSize: 32, fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: spacing.xl },
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
  forgotRow: { alignItems: 'flex-end', marginBottom: spacing.sm },
  forgotText: { color: colors.textSoft, fontSize: 13 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: colors.textSoft, textAlign: 'center', marginTop: spacing.lg },
});
