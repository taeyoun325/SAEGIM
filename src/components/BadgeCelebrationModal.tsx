import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import Text from './Text';
import { colors, spacing, radius } from '../constants/theme';
import { BadgeDef } from '../constants/badges';

interface Props {
  badge: BadgeDef | null;
  onClose: () => void;
}

// 배지는 3/7/15/30/50/100일처럼 자주 오지 않는 이정표라서, 다른 안내와 같은
// 평범한 확인창으로 처리하면 존재감이 묻힌다. "이정표는 드물게, 다르게
// 축하해야 계속 기억에 남는다"는 리텐션 자료를 참고해 전용 모달로 분리했다.
export default function BadgeCelebrationModal({ badge, onClose }: Props) {
  return (
    <Modal visible={!!badge} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{badge?.emoji}</Text>
          <Text style={styles.eyebrow}>새 배지 획득!</Text>
          <Text style={styles.name}>{badge?.name}</Text>
          <Text style={styles.description}>{badge?.description}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    maxWidth: 320,
    width: '100%',
  },
  emoji: { fontSize: 64, marginBottom: spacing.sm },
  eyebrow: { fontSize: 13, color: colors.textSoft, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.xs },
  name: { fontSize: 24, fontWeight: '800', color: colors.primary, marginBottom: spacing.sm, textAlign: 'center' },
  description: { fontSize: 14, color: colors.text, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
