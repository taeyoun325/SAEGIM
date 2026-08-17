import React, { forwardRef } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import Text from './Text';
import { colors, spacing, radius, fonts } from '../constants/theme';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

interface Props {
  lines: string[];
  createdAt: number;
}

// 캡처 전용 카드. 화면 밖에 렌더링돼 실제로 보이진 않지만
// 레이아웃이 있어야 view-shot/html-to-image가 캡처할 수 있다.
const ShareCard = forwardRef<View, Props>(({ lines, createdAt }, ref) => {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Text style={styles.appName}>새김</Text>
      <View style={styles.body}>
        {lines.map((line, i) => (
          <Text key={i} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>
      <View style={styles.footer}>
        <Image source={require('../assets/mascot-share.png')} style={styles.mascot} resizeMode="contain" />
        <Text style={styles.date}>{formatDisplayDate(timestampToDateString(createdAt))}</Text>
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
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  appName: { fontFamily: fonts.regular, fontSize: 22, color: colors.primary, fontWeight: '800' },
  body: { flexGrow: 1, justifyContent: 'center', marginVertical: spacing.xl },
  line: { fontFamily: fonts.regular, color: colors.text, fontSize: 22, lineHeight: 34 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mascot: { width: 56, height: 56 },
  date: { color: colors.textSoft, fontSize: 13 },
});
