import React, { forwardRef } from 'react';
import { View, StyleSheet, Image } from 'react-native';
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
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: theme.background }]}>
      <Text style={[styles.appName, { color: theme.accentColor }]}>새김</Text>
      <View style={styles.body}>
        {theme.showQuoteMarks && <Text style={[styles.quote, { color: theme.accentColor }]}>❝</Text>}
        {lines.map((line, i) => (
          <Text key={i} style={[styles.line, { color: theme.textColor }]}>
            {line}
          </Text>
        ))}
      </View>
      <View style={styles.footer}>
        {theme.showMascot && <Image source={require('../assets/mascot-share.png')} style={styles.mascot} resizeMode="contain" />}
        <View style={styles.footerText}>
          <Text style={[styles.date, { color: theme.textColor }]}>{formatDisplayDate(timestampToDateString(createdAt))}</Text>
          <Text style={[styles.url, { color: theme.textColor }]}>saegim.web.app</Text>
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
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  appName: { fontFamily: fonts.regular, fontSize: 22, fontWeight: '800' },
  body: { flexGrow: 1, justifyContent: 'center', marginVertical: spacing.xl },
  quote: { fontSize: 40, fontWeight: '800', marginBottom: spacing.xs, opacity: 0.6 },
  line: { fontFamily: fonts.regular, fontSize: 22, lineHeight: 34 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mascot: { width: 56, height: 56 },
  footerText: { alignItems: 'flex-end', marginLeft: 'auto' },
  date: { fontSize: 13, opacity: 0.7 },
  url: { fontSize: 11, marginTop: 2, opacity: 0.5 },
});
