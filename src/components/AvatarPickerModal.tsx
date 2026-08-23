import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Text from './Text';
import Avatar from './Avatar';
import { colors, spacing, radius } from '../constants/theme';
import { UserProfile } from '../types/models';

type AvatarType = NonNullable<UserProfile['avatarType']>;

interface Props {
  profile: UserProfile;
  onSelect: (type: AvatarType) => void;
  onClose: () => void;
}

const OPTIONS: { type: AvatarType; label: string }[] = [
  { type: 'default', label: '기본' },
  { type: 'name', label: '이름' },
  { type: 'pet', label: '펫' },
];

// 사진 업로드 없이 프로필 표시 방식을 고르는 모달.
// react-native-web에서 Modal의 visible prop을 false로 바꿔도 화면에서 안 사라지는
// 경우가 있어(관련: AppTourOverlay.tsx), 이 컴포넌트는 부모가 조건부 렌더링으로
// 마운트/언마운트해서 여닫는다 — visible prop 없이 항상 열린 채로 그린다.
export default function AvatarPickerModal({ profile, onSelect, onClose }: Props) {
  const current = profile.avatarType ?? 'name';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>프로필 표시</Text>
          <View style={styles.row}>
            {OPTIONS.map((opt) => {
              const selected = current === opt.type;
              const hasPet = !!profile.characterSpeciesId;
              const hint = opt.type === 'pet' && !hasPet ? '(알부터 고르면 보여요)' : null;
              return (
                <TouchableOpacity
                  key={opt.type}
                  style={[styles.item, selected && styles.itemSelected]}
                  onPress={() => onSelect(opt.type)}
                  accessibilityRole="button"
                  accessibilityLabel={`프로필을 ${opt.label}(으)로 설정${selected ? ', 선택됨' : ''}`}
                  aria-selected={selected}
                >
                  <Avatar profile={{ ...profile, avatarType: opt.type }} size={56} />
                  <Text style={styles.name}>{opt.label}</Text>
                  {hint ? <Text style={styles.hint}>{hint}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기">
            <Text style={styles.closeButtonText}>닫기</Text>
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
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  item: { alignItems: 'center', width: 88, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  itemSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  name: { marginTop: spacing.xs, fontSize: 13, fontWeight: '700', color: colors.text },
  hint: { marginTop: 2, fontSize: 10, color: colors.textSoft, textAlign: 'center' },
  closeButton: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.md },
  closeButtonText: { color: colors.textSoft, fontWeight: '600' },
});
