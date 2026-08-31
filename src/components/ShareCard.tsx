import { forwardRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Text from './Text';
import { spacing, radius, fonts } from '../constants/theme';
import { ShareTheme, DEFAULT_SHARE_THEME, SharePattern } from '../constants/shareThemes';
import { formatDisplayDate, timestampToDateString } from '../utils/date';

interface Props {
  lines: string[];
  createdAt: number;
  theme?: ShareTheme;
  // 테마가 요구하는 글꼴이 실제로 준비된 뒤에 넘어온다(shareFontService).
  // 아직 준비 전이거나 불러오지 못했으면 기본 글꼴로 그린다.
  fontFamily?: string;
}

const CARD_WIDTH = 360;
const CARD_HEIGHT = CARD_WIDTH * 1.25;

// 배경 무늬는 이미지를 가져다 쓰지 않고 작은 View를 규칙적으로 깔아 그린다.
// 원격 이미지를 쓰면 오프라인에서 카드가 반쯤 빈 채로 찍히는데, 공유는 그럴 때 더 잦다.
function PatternLayer({ pattern, color }: { pattern: SharePattern; color: string }) {
  // 좌표 계산은 카드 크기가 고정이라 한 번만 하면 된다.
  const cells = useMemo(() => {
    if (pattern === 'dots') {
      // 촘촘하면 본문 위로 점이 겹쳐 글이 읽기 어려워진다(실측 확인). 넉넉히 벌린다.
      const gap = 34;
      const out: { left: number; top: number }[] = [];
      for (let y = gap; y < CARD_HEIGHT; y += gap) {
        for (let x = gap; x < CARD_WIDTH; x += gap) out.push({ left: x, top: y });
      }
      return out;
    }
    if (pattern === 'stars') {
      // 흩뿌린 느낌이지만 매번 달라지면 안 된다(같은 글은 같은 카드).
      // 고정 좌표 목록을 그대로 쓴다.
      return [
        { left: 38, top: 54 }, { left: 96, top: 32 }, { left: 150, top: 78 },
        { left: 214, top: 44 }, { left: 286, top: 66 }, { left: 322, top: 118 },
        { left: 60, top: 128 }, { left: 268, top: 168 }, { left: 30, top: 214 },
        { left: 332, top: 246 }, { left: 118, top: 336 }, { left: 226, top: 372 },
        { left: 54, top: 398 }, { left: 302, top: 412 }, { left: 168, top: 428 },
      ];
    }
    return [];
  }, [pattern]);

  if (pattern === 'rules') {
    const gap = 34;
    const rows = [];
    for (let y = gap * 2; y < CARD_HEIGHT - gap; y += gap) rows.push(y);
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {rows.map((top) => (
          <View key={top} style={[styles.rule, { top, backgroundColor: color }]} />
        ))}
      </View>
    );
  }

  if (cells.length === 0) return null;

  const size = pattern === 'stars' ? 2.5 : 2;
  // 밤하늘의 별은 눈에 띄어야 하지만, 점무늬는 배경으로만 남아야 글이 주인공이 된다.
  const opacity = pattern === 'stars' ? 0.55 : 0.2;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cells.map((c, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: c.left,
            top: c.top,
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: color,
            opacity,
          }}
        />
      ))}
    </View>
  );
}

// 캡처 전용 카드. 화면 밖에 렌더링돼 실제로 보이진 않지만
// 레이아웃이 있어야 view-shot/html-to-image가 캡처할 수 있다.
const ShareCard = forwardRef<View, Props>(({ lines, createdAt, theme = DEFAULT_SHARE_THEME, fontFamily }, ref) => {
  // 글이 짧으면 크게, 길면 조금 작게 잡아 카드가 항상 꽉 차 보이게 한다.
  const totalLength = lines.join('').length;
  const lineFontSize = totalLength <= 40 ? 26 : totalLength <= 80 ? 23 : 20;
  const family = fontFamily ?? fonts.regular;
  // 손글씨(개구)는 같은 크기로 찍으면 다른 글꼴보다 확연히 작아 보인다. 조금 키운다.
  const sizeScale = family.startsWith('Gaegu') ? 1.25 : 1;
  const bodySize = Math.round(lineFontSize * sizeScale);

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />
      {/* 배경에 아주 옅게 깔리는 장식 원 두 개. 단색 배경의 빈 느낌을 덜어준다. */}
      <View style={[styles.blob, styles.blobTop, { backgroundColor: theme.blobColor }]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobBottom, { backgroundColor: theme.blobColor }]} pointerEvents="none" />
      <PatternLayer pattern={theme.pattern} color={theme.accentColor} />
      {theme.framed && <View style={[styles.frame, { borderColor: theme.accentColor }]} pointerEvents="none" />}

      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={[styles.appName, { color: theme.accentColor }]}>새김</Text>
          <View style={[styles.accentBar, { backgroundColor: theme.accentColor }]} />
        </View>

        <View style={styles.body}>
          {theme.showQuoteMarks && (
            <Text style={[styles.quote, { color: theme.accentColor, fontFamily: family }]}>❝</Text>
          )}
          {lines.map((line, i) => (
            <Text
              key={i}
              style={[
                styles.line,
                { color: theme.textColor, fontFamily: family, fontSize: bodySize, lineHeight: bodySize * 1.55 },
              ]}
            >
              {line}
            </Text>
          ))}
          {theme.showQuoteMarks && (
            <Text style={[styles.quoteClose, { color: theme.accentColor, fontFamily: family }]}>❞</Text>
          )}
        </View>

        <View style={styles.footer}>
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

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    minHeight: CARD_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  inner: { flex: 1, padding: spacing.xl, justifyContent: 'space-between' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.28 },
  blobTop: { width: 210, height: 210, top: -90, right: -70 },
  blobBottom: { width: 150, height: 150, bottom: -60, left: -50, opacity: 0.2 },
  rule: { position: 'absolute', left: spacing.xl, right: spacing.xl, height: 1, opacity: 0.18 },
  frame: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    opacity: 0.35,
  },
  header: { alignItems: 'flex-start' },
  appName: { fontFamily: fonts.regular, fontSize: 22, fontWeight: '800' },
  accentBar: { width: 28, height: 3, borderRadius: 2, marginTop: spacing.xs, opacity: 0.8 },
  body: { flexGrow: 1, justifyContent: 'center', marginVertical: spacing.lg },
  quote: { fontSize: 40, fontWeight: '800', marginBottom: spacing.xs, opacity: 0.55 },
  quoteClose: { fontSize: 40, fontWeight: '800', marginTop: spacing.xs, opacity: 0.55, textAlign: 'right' },
  line: {},
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerText: { alignItems: 'flex-end', marginLeft: 'auto' },
  date: { fontSize: 13, opacity: 0.7 },
  url: { fontSize: 11, marginTop: 2, fontWeight: '600', opacity: 0.9 },
});
