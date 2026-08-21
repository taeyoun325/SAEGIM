import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { submitReport } from '../services/reportService';
import { ReportReason } from '../types/models';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: '스팸' },
  { value: 'abuse', label: '욕설/괴롭힘' },
  { value: 'inappropriate', label: '부적절한 콘텐츠' },
  { value: 'ad', label: '광고' },
  { value: 'other', label: '기타' },
];

export default function ReportScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { targetType, targetId } = route.params as { targetType: 'post' | 'comment'; targetId: string };
  const { user } = useAuth();
  const { notify, confirm } = useDialog();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // ref로 관리한다 — handleSubmit에서 setSubmitted(true) 직후 곧바로 goBack()을
  // 호출하는데, state는 리렌더를 거쳐야 반영되어 그 사이 beforeRemove 리스너가
  // 아직 이전 렌더의(즉 false인) 클로저를 들고 있는 채로 먼저 발동해버린다.
  // ref는 리렌더 없이 즉시 최신값을 읽으므로 이 경쟁을 없앤다.
  const submittedRef = useRef(false);

  // 추가 설명을 써놓고 뒤로가기를 누르면 아무 안내 없이 그대로 날아갔다 —
  // 신고 사유 선택과 달리 이 화면은 별도 스택 라우트라 뒤로가면 다시 못 돌아온다.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (submittedRef.current || !detail.trim()) return;
      e.preventDefault();
      confirm({
        title: '작성 중인 내용이 있어요',
        message: '지금 나가면 입력한 추가 설명이 사라져요. 나갈까요?',
        confirmLabel: '나가기',
        destructive: true,
      }).then((ok) => {
        if (ok) navigation.dispatch(e.data.action);
      });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, detail]);

  async function handleSubmit() {
    if (!user || !reason) return;
    setSubmitting(true);
    try {
      await submitReport(targetType, targetId, user.uid, reason, detail);
      await notify('신고가 접수되었어요.', '검토 후 조치할게요.');
      submittedRef.current = true;
      navigation.goBack();
    } catch (e: any) {
      await notify('오류', e?.message || '신고에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>신고 이유를 선택해주세요</Text>
      {REASONS.map((r) => (
        <TouchableOpacity
          key={r.value}
          style={[styles.reasonRow, reason === r.value && styles.reasonRowSelected]}
          onPress={() => setReason(r.value)}
          accessibilityRole="button"
          accessibilityLabel={`신고 이유: ${r.label}`}
          aria-selected={reason === r.value}
        >
          <Text style={styles.reasonText}>{r.label}</Text>
        </TouchableOpacity>
      ))}
      <TextInput
        style={styles.detailInput}
        placeholder="추가 설명 (선택)"
        placeholderTextColor={colors.textSoft}
        value={detail}
        onChangeText={setDetail}
        multiline
      />
      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={!reason || submitting}
        accessibilityRole="button"
        accessibilityLabel="신고하기"
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>신고하기</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg },
  reasonRow: { padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  reasonRowSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  reasonText: { color: colors.text },
  detailInput: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
    minHeight: 80,
    color: colors.text,
  },
  submitButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  submitText: { color: '#fff', fontWeight: '700' },
});
