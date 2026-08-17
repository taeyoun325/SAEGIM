import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Text from './Text';
import { colors, spacing, radius } from '../constants/theme';
import { SHARE_THEMES, ShareTheme } from '../constants/shareThemes';

interface Props {
  visible: boolean;
  onSelect: (theme: ShareTheme) => void;
  onClose: () => void;
}

// 공유 직전에 카드 테마를 고르는 모달. 고르면 바로 해당 테마로 캡처+공유가 진행된다.
export default function ShareThemeModal({ visible, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>공유 카드 테마</Text>
          <View style={styles.grid}>
            {SHARE_THEMES.map((theme) => (
              <TouchableOpacity key={theme.id} style={styles.item} onPress={() => onSelect(theme)}>
                <View style={[styles.swatch, { backgroundColor: theme.background, borderColor: theme.accentColor }]}>
                  <Text style={[styles.swatchText, { color: theme.textColor }]}>새김</Text>
                </View>
                <Text style={styles.name}>{theme.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: colors.primary, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  item: { alignItems: 'center', width: 72 },
  swatch: { width: 56, height: 56, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatchText: { fontSize: 11, fontWeight: '700' },
  name: { marginTop: spacing.xs, fontSize: 12, color: colors.text },
  closeButton: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.md },
  closeButtonText: { color: colors.textSoft, fontWeight: '600' },
});
