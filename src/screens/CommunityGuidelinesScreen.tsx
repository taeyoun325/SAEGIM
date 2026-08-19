import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Text from '../components/Text';
import { colors, spacing } from '../constants/theme';
import { APP_NAME, CONTACT_EMAIL } from '../constants/appInfo';

export default function CommunityGuidelinesScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>커뮤니티 가이드라인</Text>

      <Section title="1. 새김이 지향하는 것">
        {APP_NAME}은 하루 세 줄, 솔직한 생각을 나누는 공간이에요. 화려한 글이 아니라
        오늘 나에게 있었던 일과 생각을 편하게 남기고, 다른 사람이 남긴 생각도 같은
        마음으로 존중해주세요.
      </Section>

      <Section title="2. 이런 콘텐츠는 올리지 말아주세요">
        • 스팸/도배: 같은 내용을 반복해서 올리는 행위{'\n'}
        • 욕설·괴롭힘: 특정인을 향한 모욕, 혐오 표현{'\n'}
        • 부적절한 콘텐츠: 선정적이거나 폭력적인 내용, 그 밖에 다른 사람에게 불쾌감을 주는 내용{'\n'}
        • 광고·홍보: 제품·서비스 홍보, 스팸성 링크{'\n'}
        • 그 밖에 커뮤니티에 해가 되는 행동
      </Section>

      <Section title="3. 신고와 검토">
        위 항목에 해당하는 글이나 댓글을 보면 [신고하기]로 알려주세요. 관리자가
        검토해 정책 위반이 확인되면 해당 콘텐츠를 삭제하고, 삭제 사실과 이유를
        작성자에게 알려드려요. 신고해주신 분께도 처리 결과를 알려드려요.{'\n\n'}
        판단이 애매한 글은 신중하게 검토하며, 단순히 의견이 다르다는 이유만으로
        삭제하지 않아요.
      </Section>

      <Section title="4. 이의가 있다면">
        신고 처리 결과나 콘텐츠 삭제에 대해 이의가 있으시면 아래 이메일로
        알려주세요. 다시 한번 검토해드릴게요.{'\n\n'}
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
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  body: { color: colors.text, lineHeight: 22, fontSize: 14 },
});
