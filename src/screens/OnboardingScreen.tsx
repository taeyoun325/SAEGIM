import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import Text from '../components/Text';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';
import { colors, spacing, radius } from '../constants/theme';
import { markOnboardingDone } from '../services/onboardingService';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

const PAGES = [
  { title: '새김에 오신 것을 환영해요', body: '매일 하나의 글감\n오늘의 생각을 새겨보세요.' },
  { title: '오늘의 생각을 새겨보세요', body: '새긴 생각은 나만 보고,\n게시하면 모두와 나눠요.' },
  { title: '같은 날, 다른 생각들', body: '같은 글감으로 사람들이\n새긴 생각을 함께 읽어보세요.\n지금 로그인하고 오늘의 글감부터 써볼까요?' },
];

export default function OnboardingScreen({ navigation }: Props) {
  const [page, setPage] = useState(0);
  const { width } = useWindowDimensions();
  const isLast = page === PAGES.length - 1;

  async function skip() {
    await markOnboardingDone();
    navigation.replace('Login');
  }

  return (
    <View style={[styles.container, { width }]}>
      {!isLast && (
        <TouchableOpacity style={styles.skipButton} onPress={skip} accessibilityRole="button" accessibilityLabel="건너뛰고 바로 시작하기">
          <Text style={styles.skipButtonText}>건너뛰기</Text>
        </TouchableOpacity>
      )}
      <View style={styles.content}>
        <Text style={styles.title}>{PAGES[page].title}</Text>
        <Text style={styles.body}>{PAGES[page].body}</Text>
      </View>
      <View style={styles.dots}>
        {PAGES.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={async () => {
          if (!isLast) {
            setPage(page + 1);
            return;
          }
          await skip();
        }}
      >
        <Text style={styles.buttonText}>{isLast ? '시작하기' : '다음'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'space-between', padding: spacing.lg },
  skipButton: { alignSelf: 'flex-end', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  skipButtonText: { color: colors.textSoft, fontSize: 14 },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  body: { fontSize: 16, color: colors.textSoft, lineHeight: 26 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: 4 },
  dotActive: { backgroundColor: colors.accent, width: 20 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
