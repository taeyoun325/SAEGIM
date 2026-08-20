import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { useFocusEffect } from '@react-navigation/native';
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
  TRASH_GRACE_DAYS,
} from '../services/writingService';
import { deleteWritingCompletely, updatePostContent } from '../services/postService';
import { syncUserCounts } from '../services/userService';
import { exportWritings } from '../services/exportService';
import { WRITING_TOTAL_MAX_LENGTH } from '../constants/config';
import { formatDisplayDate, timestampToDateString } from '../utils/date';
import { moodLabel } from '../constants/moods';

export default function MyWritingsScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { confirm, notify } = useDialog();
  const [writings, setWritings] = useState<Writing[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
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
    if (!q) return writings;
    return writings.filter((w) => w.lines.some((l) => l.includes(q)));
  }, [writings, query]);

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
    const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      total: writings.length,
      dayCount: days.size,
      topMonth: topMonth ? `${topMonth[0].replace('-', '년 ')}월` : null,
      topCategory: topCategory ? topCategory[0] : null,
      topMood: topMood ? { emoji: topMood[0], label: moodLabel(topMood[0]) } : null,
    };
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
                  accessibilityLabel="내 새김 내보내기"
                >
                  <Text style={styles.exportButtonText}>📤 내보내기</Text>
                </TouchableOpacity>
              </View>
            </View>
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
            <TextInput
              style={styles.searchInput}
              placeholder="내용 검색"
              placeholderTextColor={colors.textSoft}
              value={query}
              onChangeText={setQuery}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{query ? '검색 결과가 없어요.' : '아직 새긴 생각이 없어요.'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openDetail(item)}>
            <View style={styles.rowHeader}>
              <View style={styles.rowDateGroup}>
                <Text style={styles.rowDate}>{formatDisplayDate(timestampToDateString(item.createdAt))}</Text>
                {item.mood && <Text style={styles.rowMood}>{item.mood}</Text>}
              </View>
              <Text style={item.visibility === 'public' ? styles.publicBadge : styles.privateBadge}>
                {item.visibility === 'public' ? '🌐 공개' : '🔒 비공개'}
              </Text>
            </View>
            <Text style={styles.rowPreview} numberOfLines={2}>
              {item.lines.join(' · ')}
            </Text>
          </TouchableOpacity>
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
                        <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={() => setEditing(false)} disabled={busy}>
                          <Text style={styles.buttonOutlineText}>취소</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.button} onPress={handleSaveEdit} disabled={busy}>
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
                        <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={() => setEditing(true)} disabled={busy}>
                          <Text style={styles.buttonOutlineText}>수정</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleDelete} disabled={busy}>
                          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>삭제</Text>}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}
              <TouchableOpacity style={styles.closeButton} onPress={closeDetail}>
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
              비공개 글을 지우면 여기 {TRASH_GRACE_DAYS}일 동안 보관돼요. 기한이 지나면 완전히 사라져요.
            </Text>
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
                      <TouchableOpacity onPress={() => handleRestore(w)} disabled={busy}>
                        <Text style={styles.restoreText}>복구</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => setTrashVisible(false)}>
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
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  titleButtons: { flexDirection: 'row', gap: spacing.sm },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary },
  exportButton: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  exportButtonText: { color: colors.textSoft, fontSize: 13, fontWeight: '600' },
  statsCard: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
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
});
