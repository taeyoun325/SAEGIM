import { useState } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../constants/theme';
import { NICKNAME_MAX_LENGTH } from '../constants/config';
import { getPasswordStrength, PasswordStrength, PASSWORD_STRENGTH_LABEL } from '../utils/password';

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: colors.danger,
  medium: colors.accent,
  strong: colors.success,
};
const STRENGTH_FILL: Record<PasswordStrength, number> = {
  weak: 1 / 3,
  medium: 2 / 3,
  strong: 1,
};

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp() {
    setError(null);
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, nickname);
    } catch (e: any) {
      setError(e?.message || '회원가입에 실패했어요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.logo}>새김</Text>
      <TextInput
        style={styles.input}
        placeholder="닉네임"
        placeholderTextColor={colors.textSoft}
        maxLength={NICKNAME_MAX_LENGTH}
        value={nickname}
        onChangeText={setNickname}
      />
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
        placeholder="비밀번호 (6자 이상)"
        placeholderTextColor={colors.textSoft}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {password.length > 0 && (
        <View style={styles.strengthRow}>
          <View style={styles.strengthTrack}>
            <View
              style={[
                styles.strengthFill,
                { width: `${STRENGTH_FILL[getPasswordStrength(password)] * 100}%`, backgroundColor: STRENGTH_COLOR[getPasswordStrength(password)] },
              ]}
            />
          </View>
          <Text style={[styles.strengthLabel, { color: STRENGTH_COLOR[getPasswordStrength(password)] }]}>
            {PASSWORD_STRENGTH_LABEL[getPasswordStrength(password)]}
          </Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>회원가입</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>이미 계정이 있으신가요? 로그인</Text>
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
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  strengthTrack: { flex: 1, height: 4, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: radius.full },
  strengthLabel: { fontSize: 12, fontWeight: '700', width: 32 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: colors.textSoft, textAlign: 'center', marginTop: spacing.lg },
});
