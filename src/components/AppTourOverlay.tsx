import { useState } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './Text';
import Mascot from './Mascot';
import { colors, spacing, radius } from '../constants/theme';
import { useIsWideWeb } from '../hooks/useResponsive';
import { MainTabParamList } from '../navigation/types';

interface Props {
  onFinish: () => void;
}

// 탭바에 실제로 등록된 순서(MainTabs.tsx)와 반드시 같아야 하이라이트 위치가 맞는다.
const TAB_ORDER: (keyof MainTabParamList)[] = ['Profile', 'Character', 'Today', 'Feed', 'Calendar'];

const STEPS: { tab: keyof MainTabParamList; title: string; body: string }[] = [
  { tab: 'Today', title: '오늘의 글감', body: '매일 하나씩 도착하는 글감에 맞춰 3줄로 오늘의 생각을 새겨보세요.' },
  { tab: 'Feed', title: '피드', body: '같은 글감으로 다른 사람들이 새긴 생각을 읽고, 좋아요와 댓글을 남길 수 있어요.' },
  { tab: 'Calendar', title: '캘린더', body: '내가 새긴 날들을 캘린더에서 한눈에 돌아볼 수 있어요.' },
  { tab: 'Character', title: '펫', body: '꾸준히 새길수록 펫이 함께 자라요. 도감에서 모아보세요.' },
  { tab: 'Profile', title: '프로필', body: '내가 공개한 글과 기록을 프로필에서 확인할 수 있어요.' },
];

// 하단 탭바(모바일)/좌측 사이드바(넓은 웹) 크기는 MainTabs.tsx의 스타일 값과 같아야
// 하이라이트가 실제 탭 위치와 어긋나지 않는다.
const SIDEBAR_WIDTH = 220;
const SIDEBAR_ITEM_HEIGHT = 52 + 3 * 2;
const MOBILE_BAR_HEIGHT = 60;

export default function AppTourOverlay({ onFinish }: Props) {
  const [step, setStep] = useState(0);
  const isWideWeb = useIsWideWeb();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLast = step === STEPS.length - 1;
  const tabIndex = TAB_ORDER.indexOf(STEPS[step].tab);

  const mobileBarHeight = MOBILE_BAR_HEIGHT + insets.bottom;

  // 모달은 App.tsx가 좁은 웹 창에서 앱을 가운데 정렬된 "휴대폰 프레임"(최대 430×932)
  // 안에 그려두는 것과 무관하게 항상 브라우저 창 전체를 기준으로 렌더링된다.
  // 그래서 실제 탭바 위치를 계산하려면 이 프레임의 위치·크기를 여기서도 같이 구해야
  // 하이라이트가 진짜 탭바와 어긋나지 않는다(App.tsx의 phoneFrame 스타일과 반드시 같은 값).
  const useNarrowFrame = Platform.OS === 'web' && !isWideWeb;
  const frameWidth = useNarrowFrame ? Math.min(width, 430) : width;
  const frameHeight = useNarrowFrame ? Math.min(height, 932) : height;
  const frameLeft = useNarrowFrame ? (width - frameWidth) / 2 : 0;
  const frameTop = useNarrowFrame ? (height - frameHeight) / 2 : 0;

  const columnWidth = frameWidth / TAB_ORDER.length;
  const barTop = frameTop + frameHeight - mobileBarHeight;

  const highlightStyle = isWideWeb
    ? {
        left: spacing.md,
        top: spacing.lg + tabIndex * SIDEBAR_ITEM_HEIGHT + 3,
        width: SIDEBAR_WIDTH - spacing.md * 2,
        height: SIDEBAR_ITEM_HEIGHT - 6,
      }
    : {
        left: frameLeft + tabIndex * columnWidth + 6,
        top: barTop + 4,
        width: columnWidth - 12,
        height: mobileBarHeight - 8,
      };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFinish}>
      <View style={StyleSheet.absoluteFill}>
        {/* 실제 탭바(하단 또는 좌측)는 이 모달 아래 그대로 남아있다. 그 위치만 비워서
            흐려지지 않고 그대로 보이게 하고, 나머지 화면만 어둡게 가린다. */}
        {isWideWeb ? (
          <View style={[styles.scrim, { top: 0, left: SIDEBAR_WIDTH, width: width - SIDEBAR_WIDTH, height }]} />
        ) : (
          <>
            <View style={[styles.scrim, { top: 0, left: 0, width, height: barTop }]} />
            <View style={[styles.scrim, { top: barTop, left: 0, width: frameLeft, height: mobileBarHeight }]} />
            <View
              style={[
                styles.scrim,
                { top: barTop, left: frameLeft + frameWidth, width: width - frameLeft - frameWidth, height: mobileBarHeight },
              ]}
            />
          </>
        )}

        <View style={[styles.highlightRing, highlightStyle]} pointerEvents="none" />

        <TouchableOpacity
          style={[styles.skipButton, { top: insets.top + spacing.sm }]}
          onPress={onFinish}
          accessibilityRole="button"
          accessibilityLabel="사용법 안내 건너뛰기"
        >
          <Text style={styles.skipButtonText}>건너뛰기</Text>
        </TouchableOpacity>

        <View style={styles.cardWrap} pointerEvents="box-none">
          <View style={styles.card}>
            <Mascot size={56} />
            <Text style={styles.title}>{STEPS[step].title}</Text>
            <Text style={styles.body}>{STEPS[step].body}</Text>
            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
              ))}
            </View>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => (isLast ? onFinish() : setStep(step + 1))}
              accessibilityRole="button"
              accessibilityLabel={isLast ? '안내 마치기' : '다음 안내 보기'}
            >
              <Text style={styles.nextButtonText}>{isLast ? '시작하기' : '다음'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', backgroundColor: 'rgba(46,42,38,0.72)' },
  highlightRing: {
    position: 'absolute',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  skipButton: { position: 'absolute', right: spacing.lg, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  skipButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: spacing.sm, marginBottom: spacing.xs, textAlign: 'center' },
  body: { fontSize: 14, color: colors.text, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  dots: { flexDirection: 'row', marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: 4 },
  dotActive: { backgroundColor: colors.accent, width: 20 },
  nextButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, width: '100%', alignItems: 'center' },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
