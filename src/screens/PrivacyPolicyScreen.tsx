import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Text from '../components/Text';
import { colors, spacing } from '../constants/theme';
import { APP_NAME, CONTACT_EMAIL, PRIVACY_POLICY_UPDATED_AT } from '../constants/appInfo';

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>개인정보처리방침</Text>
      <Text style={styles.updated}>최종 수정일: {PRIVACY_POLICY_UPDATED_AT}</Text>

      <Section title="1. 수집하는 정보">
        {APP_NAME}은 서비스 제공을 위해 아래 정보만 수집합니다.{'\n\n'}
        • 계정 정보: 이메일, 비밀번호(암호화 저장){'\n'}
        • 닉네임{'\n'}
        • 작성한 글(비공개/공개 여부 포함){'\n'}
        • 댓글, 좋아요{'\n'}
        • 신고 정보(신고자, 신고 대상, 신고 이유){'\n'}
        • 서비스 이용 데이터(가입일, 연속 작성일수 등)
      </Section>

      <Section title="2. 수집하지 않는 정보">
        이름(실명), 전화번호, 주소, 생년월일 등 서비스 제공에 필요하지 않은 개인정보는 수집하지 않습니다.
      </Section>

      <Section title="3. 이용 목적">
        수집한 정보는 계정 인증, 콘텐츠 게시·표시, 커뮤니티 안전(신고·차단) 기능 제공을 위해서만 사용됩니다. 광고나 마케팅 목적으로 이용하지 않습니다.
      </Section>

      <Section title="4. 보관 및 삭제">
        앱 내 [설정 → 계정 삭제]에서 직접 계정을 삭제할 수 있습니다.{'\n\n'}
        계정을 삭제하면 아래 데이터가 즉시 함께 삭제되며 복구할 수 없습니다.{'\n'}
        • 계정 정보 및 닉네임{'\n'}
        • 새긴 생각(비공개 글 포함){'\n'}
        • 공개한 게시물{'\n'}
        • 작성한 댓글{'\n'}
        • 누른 좋아요{'\n\n'}
        단, 커뮤니티 안전을 위해 접수된 신고 기록은 신고 대상 식별을 위해 일정 기간 보관될 수 있습니다.
      </Section>

      <Section title="5. 제3자 제공">
        법령에 따른 요청이 없는 한, 수집한 정보를 제3자에게 제공하지 않습니다.{'\n\n'}
        서비스 운영을 위해 Google Firebase(인증·데이터베이스)를 사용하며, 데이터는 Google Cloud에 저장됩니다.
      </Section>

      <Section title="6. 문의">
        개인정보 관련 문의는 아래 이메일로 연락해주세요.{'\n\n'}
        {CONTACT_EMAIL}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: spacing.xs },
  updated: { color: colors.textSoft, fontSize: 12, marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  body: { color: colors.text, lineHeight: 22, fontSize: 14 },
});
