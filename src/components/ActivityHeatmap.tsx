import { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Text from './Text';
import { colors, spacing } from '../constants/theme';
import { todayDateString } from '../utils/date';

interface Cell {
  dateStr: string;
  future: boolean;
}

const CELL = 11;
const GAP = 3;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// GitHub 잔디 스타일: 열=주(왼쪽이 과거, 오른쪽이 최신), 행=요일(일~토).
// 항상 일요일 시작 열로 맞춰야 요일 줄이 어긋나지 않는다.
function buildGrid(weeks: number) {
  const todayStr = todayDateString();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);

  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay())); // 이번 주 토요일까지 채워야 열 폭이 항상 7일로 맞다

  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1)); // 역산 기준이 토요일이라 start는 항상 일요일이 된다

  const columns: Cell[][] = [];
  const monthLabels: string[] = [];
  let prevMonth = -1;
  const cursor = new Date(start);

  for (let w = 0; w < weeks; w++) {
    const col: Cell[] = [];
    let label = '';
    for (let d = 0; d < 7; d++) {
      const dateStr = toDateStr(cursor);
      if (d === 0) {
        const month = cursor.getMonth();
        if (month !== prevMonth) {
          label = `${month + 1}월`;
          prevMonth = month;
        }
      }
      col.push({ dateStr, future: dateStr > todayStr });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(col);
    monthLabels.push(label);
  }

  return { columns, monthLabels, todayStr };
}

export default function ActivityHeatmap({
  writtenDates,
  weeks = 20,
}: {
  writtenDates: Set<string>;
  weeks?: number;
}) {
  const { columns, monthLabels, todayStr } = useMemo(() => buildGrid(weeks), [weeks]);

  return (
    <View>
      <Text style={styles.caption}>최근 {weeks}주간 새김 활동</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.monthRow}>
            {monthLabels.map((label, i) => (
              <View key={i} style={styles.monthCell}>
                {label ? <Text style={styles.monthText}>{label}</Text> : null}
              </View>
            ))}
          </View>
          <View style={styles.grid}>
            {columns.map((col, ci) => (
              <View key={ci} style={styles.column}>
                {col.map((cell, ri) => {
                  const written = writtenDates.has(cell.dateStr);
                  const isToday = cell.dateStr === todayStr;
                  return (
                    <View
                      key={ri}
                      accessibilityLabel={cell.future ? undefined : `${cell.dateStr} ${written ? '새김' : '새기지 않음'}`}
                      style={[
                        styles.cell,
                        cell.future ? styles.cellFuture : written ? styles.cellWritten : styles.cellEmpty,
                        isToday && styles.cellToday,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textSoft, fontSize: 12, marginBottom: spacing.xs },
  monthRow: { flexDirection: 'row' },
  monthCell: { width: CELL + GAP, marginRight: 0 },
  monthText: { color: colors.textSoft, fontSize: 10 },
  grid: { flexDirection: 'row', marginTop: 2 },
  column: { marginRight: GAP },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
    marginBottom: GAP,
  },
  cellEmpty: { backgroundColor: colors.border },
  cellWritten: { backgroundColor: colors.accent },
  cellFuture: { backgroundColor: 'transparent' },
  cellToday: { borderWidth: 1.5, borderColor: colors.primary },
});
