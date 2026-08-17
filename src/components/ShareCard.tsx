import { forwardRef } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Text from './Text';
import { spacing, radius, fonts } from '../constants/theme';
import { ShareTheme, DEFAULT_SHARE_THEME } from '../constants/shareThemes';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

interface Props {
  lines: string[];
  createdAt: number;
  theme?: ShareTheme;
}

// 캡처 전용 카드. 화면 밖에 렌더링돼 실제로 보이진 않지만
// 레이아웃이 있어야 view-shot/html-to-image가 캡처할 수 있다.
const ShareCard = forwardRef<View, Props>(({ lines, createdAt, theme = DEFAULT_SHARE_THEME }, ref) => {
  // 글이 짧으면 크게, 길면 조금 작게 잡아 카드가 항상 꽉 차 보이게 한다.
  const totalLength = lines.join('').length;
  const lineFontSize = totalLength <= 40 ? 26 : totalLength <= 80 ? 23 : 20;

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />
      {/* 배경에 아주 옅게 깔리는 장식 원 두 개. 단색 배경의 빈 느낌을 덜어준다. */}
      <View style={[styles.blob, styles.blobTop, { backgroundColor: theme.blobColor }]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobBottom, { backgroundColor: theme.blobColor }]} pointerEvents="none" />

      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={[styles.appName, { color: theme.accentColor }]}>새김</Text>
          <View style={[styles.accentBar, { backgroundColor: theme.accentColor }]} />
        </View>

        <View style={styles.body}>
          {theme.showQuoteMarks && <Text style={[styles.quote, { color: theme.accentColor }]}>❝</Text>}
          {lines.map((line, i) => (
            <Text key={i} style={[styles.line, { color: theme.textColor, fontSize: lineFontSize, lineHeight: lineFontSize * 1.55 }]}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.footer}>
          {theme.showMascot && <Image source={require('../assets/mascot-share.png')} style={styles.mascot} resizeMode="contain" />}
          <View style={styles.footerText}>
            <Text style={[styles.date, { color: theme.textColor }]}>{formatDisplayDate(timestampToDateString(createdAt))}</Text>
            {/* URL은 작은 글자라 강조색 대신 본문색을 옅게 써서 대비를 확보한다. */}
            <Text style={[styles.url, { color: theme.textColor }]}>saegim.web.app</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

ShareCard.displayName = 'ShareCard';
export default ShareCard;

const CARD_WIDTH = 360;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    minHeight: CARD_WIDTH * 1.25,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  inner: { flex: 1, padding: spacing.xl, justifyContent: 'space-between' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.28 },
  blobTop: { width: 210, height: 210, top: -90, right: -70 },
  blobBottom: { width: 150, height: 150, bottom: -60, left: -50, opacity: 0.2 },
  header: { alignItems: 'flex-start' },
  appName: { fontFamily: fonts.regular, fontSize: 22, fontWeight: '800' },
  accentBar: { width: 28, height: 3, borderRadius: 2, marginTop: spacing.xs, opacity: 0.8 },
  body: { flexGrow: 1, justifyContent: 'center', marginVertical: spacing.lg },
  quote: { fontSize: 40, fontWeight: '800', marginBottom: spacing.xs, opacity: 0.55 },
  line: { fontFamily: fonts.regular },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mascot: { width: 56, height: 56 },
  footerText: { alignItems: 'flex-end', marginLeft: 'auto' },
  date: { fontSize: 13, opacity: 0.7 },
  url: { fontSize: 11, marginTop: 2, fontWeight: '600', opacity: 0.9 },
});
