import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { Writing } from '../types/models';
import {
  getMyWritings,
  updateWritingContent,
  validateLines,
  softDeleteWriting,
  restoreWriting,
  getTrashedWritings,
  purgeExpiredTrash,
  deleteTrashedWriting,
  emptyTrash,
  toggleWritingFavorite,
  TRASH_GRACE_DAYS,
} from '../services/writingService';
import { deleteWritingCompletely, updatePostContent } from '../services/postService';
import { syncUserCounts } from '../services/userService';
import { exportWritings, exportWritingsJson, exportWritingsPdf } from '../services/exportService';
import { WRITING_TOTAL_MAX_LENGTH } from '../constants/config';
import { formatDisplayDate, timestampToDateString, recentDateStrings } from '../utils/date';

import { moodLabel, MOOD_OPTIONS } from '../constants/moods';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MyWritingsScreen() {
  const navigation = useNavigation<Nav>();
  const { user, profile, refreshProfile } = useAuth();
  const { confirm, notify } = useDialog();
  const [writings, setWritings] = useState<Writing[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Writing | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [trashVisible, setTrashVisible] = useState(false);
  const [trashed, setTrashed] = useState<Writing[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setWritings(await getMyWritings(user.uid));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    let list = writings;
    if (favoritesOnly) list = list.filter((w) => w.favorited);
    if (moodFilter) list = list.filter((w) => w.mood === moodFilter);
    if (categoryFilter) list = list.filter((w) => w.category === categoryFilter);
    if (q) list = list.filter((w) => w.lines.some((l) => l.includes(q)));
    return list;
  }, [writings, query, favoritesOnly, moodFilter, categoryFilter]);

  const usedMoods = useMemo(
    () => MOOD_OPTIONS.filter((m) => writings.some((w) => w.mood === m.emoji)),
    [writings]
  );

  const usedCategories = useMemo(() => {
    const set = new Set<string>();
    writings.forEach((w) => { if (w.category) set.add(w.category); });
    return Array.from(set).sort();
  }, [writings]);

  async function handleToggleFavorite(writing: Writing) {
    const next = !writing.favorited;
    setWritings((prev) => prev.map((w) => (w.id === writing.id ? { ...w, favorited: next } : w)));
    setSelected((prev) => (prev && prev.id === writing.id ? { ...prev, favorited: next } : prev));
    try {
      await toggleWritingFavorite(writing.id, next);
    } catch (e) {
      // 실패하면 낙관적으로 바꿨던 표시를 되돌린다.
      setWritings((prev) => prev.map((w) => (w.id === writing.id ? { ...w, favorited: !next } : w)));
      setSelected((prev) => (prev && prev.id === writing.id ? { ...prev, favorited: !next } : prev));
    }
  }

  const stats = useMemo(() => {
    if (writings.length === 0) return null;
    const monthCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const moodCounts: Record<string, number> = {};
    const days = new Set<string>();
    for (const w of writings) {
      const d = timestampToDateString(w.createdAt);
      days.add(d);
      const month = d.slice(0, 7);
      monthCounts[month] = (monthCounts[month] ?? 0) + 1;
      if (w.category) categoryCounts[w.category] = (categoryCounts[w.category] ?? 0) + 1;
      if (w.mood) moodCounts[w.mood] = (moodCounts[w.mood] ?? 0) + 1;
    }
    const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
    const moodEntries = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
    const topMood = moodEntries[0];
    const maxMoodCount = moodEntries[0]?.[1] ?? 0;
    return {
      total: writings.length,
      dayCount: days.size,
      topMonth: topMonth ? `${topMonth[0].replace('-', '년 ')}월` : null,
      topCategory: topCategory ? topCategory[0] : null,
      topMood: topMood ? { emoji: topMood[0], label: moodLabel(topMood[0]) } : null,
      moodDistribution: moodEntries.map(([emoji, count]) => ({
        emoji,
        label: moodLabel(emoji) ?? emoji,
        count,
        pct: maxMoodCount > 0 ? Math.round((count / maxMoodCount) * 100) : 0,
      })),
    };
  }, [writings]);

  const weekly = useMemo(() => {
    const days = recentDateStrings(7);
    const writtenDates = new Set(writings.map((w) => timestampToDateString(w.createdAt)));
    const marks = days.map((d) => {
      const [y, m, day] = d.split('-').map(Number);
      return {
        date: d,
        weekday: WEEKDAY_LABELS[new Date(y, m - 1, day).getDay()],
        written: writtenDates.has(d),
        isToday: d === days[days.length - 1],
      };
    });
    return { marks, count: marks.filter((m) => m.written).length };
  }, [writings]);

  function openDetail(w: Writing) {
    setSelected(w);
    setEditing(false);
    setEditText(w.lines.join('\n'));
  }

  function closeDetail() {
    setSelected(null);
    setEditing(false);
  }

  async function handleSaveEdit() {
    if (!selected) return;
    const lines = editText.split('\n');
    const { valid, reason } = validateLines(lines);
    if (!valid) {
      await notify('오류', reason ?? '내용을 확인해주세요.');
      return;
    }
    setBusy(true);
    try {
      await updateWritingContent(selected.id, lines);
      if (selected.postId) await updatePostContent(selected.postId, lines);
      const cleanLines = lines.filter((l) => l.trim().length > 0);
      const updated = { ...selected, lines: cleanLines };
      setWritings((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setSelected(updated);
      setEditing(false);
    } catch (e) {
      await notify('오류', '수정에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (writings.length === 0) {
      await notify('내보낼 글이 없어요', '아직 새긴 생각이 없어요.');
      return;
    }
    try {
      await exportWritings(writings);
    } catch (e) {
      await notify('오류', '내보내기에 실패했어요.');
    }
  }

  // 다른 저널링 앱으로 옮기거나 스스로 백업을 다뤄볼 사용자를 위한 구조화된 형식.
  // 텍스트 내보내기와 달리 프로그램으로 다시 읽어들이기 좋다.
  async function handleExportJson() {
    if (writings.length === 0) {
      await notify('내보낼 글이 없어요', '아직 새긴 생각이 없어요.');
      return;
    }
    try {
      await exportWritingsJson(writings);
    } catch (e) {
      await notify('오류', '내보내기에 실패했어요.');
    }
  }

  // 인쇄해서 보관하거나 선물하고 싶은 사용자를 위한 경로. 웹에서는 브라우저 인쇄
  // 대화상자로 실제 PDF 저장까지 이어진다("PDF로 저장" 선택 시).
  async function handleExportPdf() {
    if (writings.length === 0) {
      await notify('내보낼 글이 없어요', '아직 새긴 생각이 없어요.');
      return;
    }
    try {
      await exportWritingsPdf(writings);
    } catch (e) {
      await notify('오류', '내보내기에 실패했어요.');
    }
  }

  async function handleDelete() {
    if (!selected || !user) return;
    const isPrivate = selected.visibility !== 'public';
    const ok = await confirm({
      title: '이 글을 삭제할까요?',
      message: isPrivate
        ? `${TRASH_GRACE_DAYS}일 안에는 휴지통에서 복구할 수 있어요.`
        : '공개된 글이라면 다른 사람의 피드에서도 사라져요. 이 작업은 되돌릴 수 없어요.',
      confirmLabel: '삭제하기',
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      if (isPrivate) {
        // 비공개 글은 바로 지우지 않고 휴지통으로 보낸다(실수로 지운 일기를 되찾을 수 있게).
        await softDeleteWriting(selected.id);
      } else {
        // 공개된 글은 게시물과 딸린 콘텐츠까지 함께 즉시 지운다.
        await deleteWritingCompletely(selected.id, selected.postId ?? null);
      }
      setWritings((prev) => prev.filter((w) => w.id !== selected.id));
      // 개수를 직접 -1 하지 않고 실제 문서 수로 다시 맞춘다(어긋남이 누적되지 않게).
      if (profile) await syncUserCounts(user.uid, profile);
      await refreshProfile();
      closeDetail();
    } catch (e) {
      await notify('오류', '삭제에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function openTrash() {
    if (!user) return;
    setTrashVisible(true);
    setTrashLoading(true);
    try {
      await purgeExpiredTrash(user.uid);
      setTrashed(await getTrashedWritings(user.uid));
    } catch (e) {
      await notify('오류', '휴지통을 불러오지 못했어요.');
    } finally {
      setTrashLoading(false);
    }
  }

  async function handleRestore(writing: Writing) {
    if (!user) return;
    setBusy(true);
    try {
      await restoreWriting(writing.id);
      setTrashed((prev) => prev.filter((w) => w.id !== writing.id));
      await load();
    } catch (e) {
      await notify('오류', '복구에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  // 보관 기한을 기다리지 않고 바로 지운다. 지우려고 지운 글을 30일 동안 계속
  // 마주쳐야 하는 건 그 자체로 불편하고, 남기고 싶지 않은 내용이면 더욱 그렇다.
  async function handleDeleteTrashed(writing: Writing) {
    if (!user) return;
    const ok = await confirm({
      title: '완전히 삭제할까요?',
      message: '이 글은 복구할 수 없어요.',
      confirmLabel: '완전 삭제',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteTrashedWriting(writing.id);
      setTrashed((prev) => prev.filter((w) => w.id !== writing.id));
    } catch (e) {
      await notify('오류', '삭제에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEmptyTrash() {
    if (!user || trashed.length === 0) return;
    const ok = await confirm({
      title: `휴지통의 글 ${trashed.length}개를 모두 삭제할까요?`,
      message: '복구할 수 없어요.',
      confirmLabel: '모두 삭제',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await emptyTrash(user.uid);
      setTrashed([]);
    } catch (e) {
      // 중간까지 지워졌을 수 있으므로 화면 상태를 서버에서 다시 맞춘다.
      await notify('오류', '일부를 삭제하지 못했어요.');
      setTrashed(await getTrashedWritings(user.uid).catch(() => trashed));
    } finally {
      setBusy(false);
    }
  }

  function daysLeft(writing: Writing): number {
    const deletedAt = writing.deletedAt ?? Date.now();
    const elapsedDays = (Date.now() - deletedAt) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(TRASH_GRACE_DAYS - elapsedDays));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>내 새김 관리</Text>
              <View style={styles.titleButtons}>
                <TouchableOpacity
                  onPress={openTrash}
                  style={styles.exportButton}
                  accessibilityRole="button"
                  accessibilityLabel="휴지통 열기"
                >
                  <Text style={styles.exportButtonText}>🗑 휴지통</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleExport}
                  style={styles.exportButton}
                  accessibilityRole="button"
                  accessibilityLabel="내 새김 텍스트로 내보내기"
                >
                  <Text style={styles.exportButtonText}>📤 텍스트</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleExportJson}
                  style={styles.exportButton}
                  accessibilityRole="button"
                  accessibilityLabel="내 새김 JSON으로 내보내기"
                >
                  <Text style={styles.exportButtonText}>🧩 JSON</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleExportPdf}
                  style={styles.exportButton}
                  accessibilityRole="button"
                  accessibilityLabel="내 새김 인쇄용 PDF로 내보내기"
                >
                  <Text style={styles.exportButtonText}>🖨️ 인쇄/PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={styles.practiceButton}
              onPress={() => navigation.navigate('PracticeWriting')}
              accessibilityRole="button"
              accessibilityLabel="지난 글감으로 다시 써보기"
            >
              <Text style={styles.practiceButtonText}>🔁 지난 글감으로 다시 써보기</Text>
            </TouchableOpacity>
            {writings.length > 0 && (
              <View style={styles.weekCard}>
                <Text style={styles.weekTitle}>이번 주 새김 {weekly.count}/7일</Text>
                <View style={styles.weekRow}>
                  {weekly.marks.map((m) => (
                    <View key={m.date} style={styles.weekDayCol}>
                      <Text style={styles.weekDayLabel}>{m.weekday}</Text>
                      <View
                        style={[
                          styles.weekDot,
                          m.written && styles.weekDotFilled,
                          m.isToday && styles.weekDotToday,
                        ]}
                        accessibilityLabel={`${formatDisplayDate(m.date)} ${m.written ? '새김' : '새기지 않음'}${m.isToday ? ', 오늘' : ''}`}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
            {stats && (
              <View style={styles.statsCard}>
                <Text style={styles.statsHeadline}>지금까지 {stats.total}개의 생각을 남겼어요.</Text>
                <Text style={styles.statsLine}>작성한 날짜 수 {stats.dayCount}일</Text>
                {stats.topMonth && <Text style={styles.statsLine}>가장 많이 쓴 달 {stats.topMonth}</Text>}
                {stats.topCategory && <Text style={styles.statsLine}>가장 많이 쓴 글감 카테고리 "{stats.topCategory}"</Text>}
                {stats.topMood && (
                  <Text style={styles.statsLine}>가장 많이 남긴 기분 {stats.topMood.emoji} {stats.topMood.label}</Text>
                )}
              </View>
            )}
            {stats && stats.moodDistribution.length > 0 && (
              <View style={styles.statsCard}>
                <Text style={styles.statsHeadline}>기분 분포</Text>
                {stats.moodDistribution.map((m) => (
                  <View key={m.emoji} style={styles.moodBarRow}>
                    <Text style={styles.moodBarLabel}>{m.emoji} {m.label}</Text>
                    <View style={styles.moodBarTrack}>
                      <View style={[styles.moodBarFill, { width: `${Math.max(4, m.pct)}%` }]} />
                    </View>
                    <Text style={styles.moodBarCount}>{m.count}</Text>
                  </View>
                ))}
              </View>
            )}
            <TextInput
              style={styles.searchInput}
              placeholder="내용 검색"
              placeholderTextColor={colors.textSoft}
              value={query}
              onChangeText={setQuery}
            />
            <TouchableOpacity
              style={[styles.favoriteFilterChip, favoritesOnly && styles.favoriteFilterChipActive]}
              onPress={() => setFavoritesOnly((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="즐겨찾기만 보기"
              aria-selected={favoritesOnly}
            >
              <Text style={[styles.favoriteFilterChipText, favoritesOnly && styles.favoriteFilterChipTextActive]}>
                ⭐ 즐겨찾기만
              </Text>
            </TouchableOpacity>
            {usedMoods.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodFilterRow}>
                <TouchableOpacity
                  style={[styles.moodFilterChip, moodFilter === null && styles.moodFilterChipActive]}
                  onPress={() => setMoodFilter(null)}
                  accessibilityRole="button"
                  accessibilityLabel="기분 전체 보기"
                  aria-selected={moodFilter === null}
                >
                  <Text style={[styles.moodFilterChipText, moodFilter === null && styles.moodFilterChipTextActive]}>전체</Text>
                </TouchableOpacity>
                {usedMoods.map((m) => (
                  <TouchableOpacity
                    key={m.emoji}
                    style={[styles.moodFilterChip, moodFilter === m.emoji && styles.moodFilterChipActive]}
                    onPress={() => setMoodFilter((prev) => (prev === m.emoji ? null : m.emoji))}
                    accessibilityRole="button"
                    accessibilityLabel={`기분 ${m.label}만 보기`}
                    aria-selected={moodFilter === m.emoji}
                  >
                    <Text style={[styles.moodFilterChipText, moodFilter === m.emoji && styles.moodFilterChipTextActive]}>
                      {m.emoji} {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {usedCategories.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodFilterRow}>
                <TouchableOpacity
                  style={[styles.moodFilterChip, categoryFilter === null && styles.moodFilterChipActive]}
                  onPress={() => setCategoryFilter(null)}
                  accessibilityRole="button"
                  accessibilityLabel="글감 카테고리 전체 보기"
                  aria-selected={categoryFilter === null}
                >
                  <Text style={[styles.moodFilterChipText, categoryFilter === null && styles.moodFilterChipTextActive]}>전체 카테고리</Text>
                </TouchableOpacity>
                {usedCategories.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.moodFilterChip, categoryFilter === c && styles.moodFilterChipActive]}
                    onPress={() => setCategoryFilter((prev) => (prev === c ? null : c))}
                    accessibilityRole="button"
                    accessibilityLabel={`글감 카테고리 ${c}만 보기`}
                    aria-selected={categoryFilter === c}
                  >
                    <Text style={[styles.moodFilterChipText, categoryFilter === c && styles.moodFilterChipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {query || favoritesOnly || moodFilter || categoryFilter ? '조건에 맞는 글이 없어요.' : '아직 새긴 생각이 없어요.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <View style={styles.rowDateGroup}>
                <Text style={styles.rowDate}>{formatDisplayDate(timestampToDateString(item.createdAt))}</Text>
                {item.mood && <Text style={styles.rowMood}>{item.mood}</Text>}
              </View>
              <View style={styles.rowDateGroup}>
                <Text style={item.visibility === 'public' ? styles.publicBadge : styles.privateBadge}>
                  {item.visibility === 'public' ? '🌐 공개' : '🔒 비공개'}
                </Text>
                <TouchableOpacity
                  onPress={() => handleToggleFavorite(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.favorited ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  aria-selected={!!item.favorited}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.starIcon}>{item.favorited ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => openDetail(item)}
              accessibilityRole="button"
              accessibilityLabel={`${formatDisplayDate(timestampToDateString(item.createdAt))} 글 상세 보기: ${item.lines.join(' ')}`}
            >
              <Text style={styles.rowPreview} numberOfLines={2}>
                {item.lines.join(' · ')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeDetail}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
              {selected && (
                <>
                  <Text style={styles.sheetDate}>
                    {formatDisplayDate(timestampToDateString(selected.createdAt))}
                    {selected.mood ? ` ${selected.mood}` : ''}
                  </Text>
                  {editing ? (
                    <>
                      <TextInput
                        style={styles.editInput}
                        value={editText}
                        onChangeText={setEditText}
                        maxLength={WRITING_TOTAL_MAX_LENGTH}
                        multiline
                        textAlignVertical="top"
                      />
                      <Text style={styles.counter}>{editText.length}/{WRITING_TOTAL_MAX_LENGTH}</Text>
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={[styles.button, styles.buttonOutline]}
                          onPress={() => setEditing(false)}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel="수정 취소"
                        >
                          <Text style={styles.buttonOutlineText}>취소</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.button}
                          onPress={handleSaveEdit}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel="수정 저장"
                        >
                          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>저장</Text>}
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.contentCard}>
                        {selected.lines.map((l, i) => (
                          <Text key={i} style={styles.contentLine}>{l}</Text>
                        ))}
                      </View>
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={[styles.button, styles.buttonOutline]}
                          onPress={() => setEditing(true)}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel="글 수정"
                        >
                          <Text style={styles.buttonOutlineText}>수정</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.button, styles.buttonDanger]}
                          onPress={handleDelete}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel="글 삭제"
                        >
                          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>삭제</Text>}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeDetail}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Text style={styles.closeButtonText}>닫기</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={trashVisible} transparent animationType="slide" onRequestClose={() => setTrashVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetDate}>🗑 휴지통</Text>
            <Text style={styles.trashHint}>
              비공개 글을 지우면 여기 {TRASH_GRACE_DAYS}일 동안 보관돼요. 기한이 지나면 완전히 사라지고,
              기다리지 않고 지금 바로 지울 수도 있어요.
            </Text>
            {trashed.length > 0 && !trashLoading && (
              <TouchableOpacity
                onPress={handleEmptyTrash}
                disabled={busy}
                style={styles.emptyTrashButton}
                accessibilityRole="button"
                accessibilityLabel="휴지통 비우기"
              >
                <Text style={styles.emptyTrashText}>휴지통 비우기</Text>
              </TouchableOpacity>
            )}
            {trashLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
                {trashed.length === 0 ? (
                  <Text style={styles.emptyText}>휴지통이 비어있어요.</Text>
                ) : (
                  trashed.map((w) => (
                    <View key={w.id} style={styles.trashRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowPreview} numberOfLines={1}>{w.lines.join(' · ')}</Text>
                        <Text style={styles.rowDate}>{formatDisplayDate(timestampToDateString(w.createdAt))} · {daysLeft(w)}일 후 완전 삭제</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRestore(w)}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="글 복구"
                      >
                        <Text style={styles.restoreText}>복구</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteTrashed(w)}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="글 완전 삭제"
                      >
                        <Text style={styles.deleteForeverText}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setTrashVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="휴지통 닫기"
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  titleButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary },
  exportButton: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  exportButtonText: { color: colors.textSoft, fontSize: 13, fontWeight: '600' },
  practiceButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  practiceButtonText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  weekCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  weekTitle: { color: colors.primary, fontWeight: '700', fontSize: 14, marginBottom: spacing.sm },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDayCol: { alignItems: 'center', gap: spacing.xs },
  weekDayLabel: { color: colors.textSoft, fontSize: 11 },
  weekDot: { width: 20, height: 20, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  weekDotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  weekDotToday: { borderColor: colors.accent, borderWidth: 2 },
  statsCard: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  moodBarRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  moodBarLabel: { color: colors.text, fontSize: 12, width: 68 },
  moodBarTrack: { flex: 1, height: 12, backgroundColor: colors.card, borderRadius: radius.full, overflow: 'hidden' },
  moodBarFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  moodBarCount: { color: colors.textSoft, fontSize: 12, width: 20, textAlign: 'right' },
  statsHeadline: { color: colors.primary, fontWeight: '700', fontSize: 15, marginBottom: spacing.xs },
  statsLine: { color: colors.text, fontSize: 13, marginTop: 2 },
  searchInput: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    color: colors.text,
  },
  favoriteFilterChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  favoriteFilterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  favoriteFilterChipText: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
  favoriteFilterChipTextActive: { color: '#fff' },
  moodFilterRow: { gap: spacing.xs, marginBottom: spacing.md },
  moodFilterChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  moodFilterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  moodFilterChipText: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
  moodFilterChipTextActive: { color: '#fff' },
  starIcon: { fontSize: 16 },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  rowDateGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowDate: { color: colors.textSoft, fontSize: 12 },
  rowMood: { fontSize: 13 },
  publicBadge: { color: colors.success, fontSize: 12, fontWeight: '600' },
  privateBadge: { color: colors.textSoft, fontSize: 12, fontWeight: '600' },
  rowPreview: { color: colors.text, fontSize: 15, lineHeight: 22 },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSoft },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: '85%' },
  sheetDate: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: spacing.md },
  contentCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  contentLine: { color: colors.text, fontSize: 16, lineHeight: 24 },
  editInput: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 120,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  counter: { color: colors.textSoft, fontSize: 12, textAlign: 'right', marginTop: spacing.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  buttonOutlineText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  buttonDanger: { backgroundColor: colors.danger },
  closeButton: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.md },
  closeButtonText: { color: colors.textSoft, fontWeight: '600' },
  trashHint: { color: colors.textSoft, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
  trashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  restoreText: { color: colors.primary, fontWeight: '700' },
  deleteForeverText: { color: colors.danger, fontWeight: '700' },
  emptyTrashButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  emptyTrashText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
