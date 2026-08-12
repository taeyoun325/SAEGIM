import React, { useState } from 'react';
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
  const { notify } = useDialog();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!user || !reason) return;
    setSubmitting(true);
    try {
      await submitReport(targetType, targetId, user.uid, reason, detail);
      await notify('신고가 접수되었어요.', '검토 후 조치할게요.');
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
        <TouchableOpacity key={r.value} style={[styles.reasonRow, reason === r.value && styles.reasonRowSelected]} onPress={() => setReason(r.value)}>
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
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={!reason || submitting}>
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
