import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Text from './Text';
import TextInput from './TextInput';
import { colors, spacing, radius } from '../constants/theme';
import { verifyAppLockPin } from '../services/appLockService';

interface Props {
  onUnlock: () => void;
  onLogout: () => void;
}

export default function AppLockScreen({ onUnlock, onLogout }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit() {
    if (pin.length === 0) return;
    setChecking(true);
    try {
      const ok = await verifyAppLockPin(pin);
      if (ok) {
        onUnlock();
      } else {
        setError('PIN이 올바르지 않아요.');
        setPin('');
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔒 잠겨 있어요</Text>
      <Text style={styles.subtitle}>설정한 PIN을 입력해주세요.</Text>
      <TextInput
        style={styles.input}
        placeholder="PIN"
        placeholderTextColor={colors.textSoft}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={6}
        value={pin}
        onChangeText={(t) => {
          setPin(t.replace(/[^0-9]/g, ''));
          setError(null);
        }}
        onSubmitEditing={handleSubmit}
        autoFocus
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={pin.length === 0 || checking}>
        <Text style={styles.buttonText}>잠금 해제</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onLogout} style={styles.logoutLink}>
        <Text style={styles.logoutText}>PIN을 잊으셨나요? 로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: 14, color: colors.textSoft, textAlign: 'center', marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 22,
    letterSpacing: 10,
    textAlign: 'center',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, textAlign: 'center', marginBottom: spacing.sm },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutLink: { marginTop: spacing.xl, alignItems: 'center' },
  logoutText: { color: colors.textSoft, fontSize: 13 },
});
