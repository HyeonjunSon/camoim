import { useState, useCallback, useMemo } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { adminListBoards, adminCreateBoard, adminUpdateBoard, adminDeleteBoard } from '../../lib/api';
import { useLang } from '../../context/LangContext';
import { getBoardName } from '../../lib/i18n';

export default function AdminBoardsScreen() {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode, board }
  const [form, setForm] = useState({ slug: '', name: '', description: '', isAnonymousAllowed: false, sortOrder: 0, isUniversityBoard: false, university: '' });
  const [search, setSearch] = useState('');
  const [uniList, setUniList] = useState([]);
  const [collapsed, setCollapsed] = useState({}); // { [sectionKey]: true }
  const [initialized, setInitialized] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListBoards();
      if (res.success) setItems(res.data ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 기존 학교 목록 추출
  const universities = useMemo(() => {
    const set = new Set();
    items.forEach(b => { if (b.university) set.add(b.university); });
    return [...set].sort();
  }, [items]);

  const openCreate = () => {
    setForm({ slug: '', name: '', description: '', isAnonymousAllowed: false, sortOrder: items.length + 1, isUniversityBoard: false, university: '' });
    setUniList(universities);
    setModal({ mode: 'create' });
  };

  const openEdit = (b) => {
    setForm({
      slug: b.slug, name: b.name, description: b.description ?? '',
      isAnonymousAllowed: !!b.isAnonymousAllowed, sortOrder: b.sortOrder ?? 0,
    });
    setModal({ mode: 'edit', board: b });
  };

  const submit = async () => {
    try {
      if (modal.mode === 'create') {
        if (!form.slug || !form.name) return Alert.alert(t('admin.boardSlugRequired'));
        if (form.isUniversityBoard && !form.university.trim()) return Alert.alert(t('admin.boardUnivRequired'));
        await adminCreateBoard({
          ...form,
          university: form.isUniversityBoard ? form.university.trim() : '',
        });
      } else {
        await adminUpdateBoard(modal.board.id, {
          name: form.name,
          description: form.description,
          isAnonymousAllowed: form.isAnonymousAllowed,
          sortOrder: Number(form.sortOrder) || 0,
        });
      }
      setModal(null);
      load();
    } catch (e) {
      Alert.alert(t('admin.boardFailed'), e.message || t('common.error'));
    }
  };

  const onDelete = (b) => {
    Alert.alert(t('admin.boardDeleteTitle'), t('admin.boardDeleteMsg').replace('{name}', getBoardName(b.slug, b.name, t)), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try { await adminDeleteBoard(b.id); load(); }
          catch (e) { Alert.alert(t('admin.boardFailed'), e.message); }
        },
      },
    ]);
  };

  // 섹션 구성: 일반 게시판 + 학교별 게시판
  const sections = useMemo(() => {
    const s = search.trim().toLowerCase();
    const matches = (b) =>
      !s || b.name.toLowerCase().includes(s) || b.slug.toLowerCase().includes(s) ||
      (b.university && b.university.toLowerCase().includes(s));

    const global = items.filter(b => !b.isUniversityBoard && matches(b))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const uniMap = {};
    items.filter(b => b.isUniversityBoard).forEach(b => {
      const matchedBySchool = s && b.university && b.university.toLowerCase().includes(s);
      if (!s || matchedBySchool || matches(b)) {
        const key = b.university || t('admin.boardNoUniv');
        if (!uniMap[key]) uniMap[key] = [];
        uniMap[key].push(b);
      }
    });

    const result = [];
    if (global.length) {
      result.push({ key: '__global__', title: t('admin.boardGlobal'), count: global.length, data: global });
    }
    Object.keys(uniMap).sort().forEach(uni => {
      uniMap[uni].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      result.push({ key: `uni:${uni}`, title: uni, count: uniMap[uni].length, data: uniMap[uni], isUni: true });
    });
    return result;
  }, [items, search, t]);

  // 첫 로드 시 모든 섹션 접힘 상태로
  if (!initialized && sections.length > 0) {
    const init = {};
    sections.forEach(s => { init[s.key] = true; });
    setCollapsed(init);
    setInitialized(true);
  }

  // 접힌 섹션은 data를 빈 배열로 (헤더만 보이게)
  const displaySections = useMemo(
    () => sections.map(s => collapsed[s.key] ? { ...s, data: [] } : s),
    [sections, collapsed]
  );

  const toggleSection = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('admin.boardSearch')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={openCreate}>
          <Text style={styles.createText}>＋</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={displaySections}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        renderSectionHeader={({ section }) => {
          const open = !collapsed[section.key];
          return (
            <TouchableOpacity
              style={[styles.sectionHeader, section.isUni && styles.sectionHeaderUni]}
              onPress={() => toggleSection(section.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.text} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.count}</Text>
            </TouchableOpacity>
          );
        }}
        renderSectionFooter={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{getBoardName(item.slug, item.name, t)}</Text>
              <Text style={styles.slug}>{item.slug}</Text>
              <Text style={styles.meta}>
                {t('admin.boardPostCount')} {item.postCount} · {t('admin.boardSortLabel')} {item.sortOrder}
              </Text>
            </View>
            <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
              <Text style={styles.editText}>{t('common.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(item)} style={styles.delBtn}>
              <Text style={styles.delText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t('admin.boardNone')}</Text>}
      />

      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBox}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>
              {modal?.mode === 'create' ? t('admin.boardNew') : t('admin.boardEdit')}
            </Text>
            {modal?.mode === 'create' && (
              <>
                <Text style={styles.lbl}>{t('admin.boardType')}</Text>
                <View style={styles.typeRow}>
                  <TouchableOpacity
                    style={[styles.typeBtn, !form.isUniversityBoard && styles.typeBtnActive]}
                    onPress={() => setForm({ ...form, isUniversityBoard: false, university: '' })}
                  >
                    <Text style={[styles.typeBtnText, !form.isUniversityBoard && styles.typeBtnTextActive]}>{t('admin.boardGlobal')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeBtn, form.isUniversityBoard && styles.typeBtnActive]}
                    onPress={() => setForm({ ...form, isUniversityBoard: true })}
                  >
                    <Text style={[styles.typeBtnText, form.isUniversityBoard && styles.typeBtnTextActive]}>{t('admin.boardSchool')}</Text>
                  </TouchableOpacity>
                </View>

                {form.isUniversityBoard && (
                  <>
                    <Text style={styles.lbl}>{t('admin.boardUnivName')}</Text>
                    <TextInput
                      style={styles.input}
                      value={form.university}
                      onChangeText={(v) => setForm({ ...form, university: v })}
                      placeholder="예: University of Toronto"
                      placeholderTextColor={colors.textSecondary}
                    />
                    {universities.length > 0 && (
                      <View style={styles.uniChipRow}>
                        {universities.filter(u => !form.university || u.toLowerCase().includes(form.university.toLowerCase())).slice(0, 5).map(u => (
                          <TouchableOpacity key={u} style={styles.uniChip} onPress={() => setForm({ ...form, university: u })}>
                            <Text style={styles.uniChipText}>{u}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}

                <Text style={styles.lbl}>{t('admin.boardSlug')}</Text>
                <TextInput
                  style={styles.input}
                  value={form.slug}
                  onChangeText={(v) => setForm({ ...form, slug: v })}
                  autoCapitalize="none"
                  placeholder="free"
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            )}
            <Text style={styles.lbl}>{t('admin.boardName')}</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              placeholder={t('admin.boardNamePh')}
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.lbl}>{t('admin.boardDesc')}</Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
              placeholder={t('admin.boardDescPh')}
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <Text style={styles.lbl}>{t('admin.boardSort')}</Text>
            <TextInput
              style={styles.input}
              value={String(form.sortOrder)}
              onChangeText={(v) => setForm({ ...form, sortOrder: v })}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(null)}>
                <Text style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={submit}>
                <Text style={{ color: colors.white, fontWeight: '700' }}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.inputBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingBottom: 4 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, height: 42, backgroundColor: colors.surface, borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  createBtn: {
    width: 42, height: 42, backgroundColor: colors.primary,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  createText: { color: colors.white, fontSize: 22, fontWeight: '700', lineHeight: 24 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, height: 40, backgroundColor: colors.surface,
    borderRadius: 10, marginTop: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionHeaderUni: { backgroundColor: colors.primary + '18' },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.text },
  sectionCount: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.surface, borderRadius: 8,
  },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 60 },
  card: {
    backgroundColor: colors.surface, padding: 14, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  slug: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.inputBg, borderRadius: 8 },
  editText: { fontSize: 12, fontWeight: '600', color: colors.text },
  delBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.danger + '15', borderRadius: 8 },
  delText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: colors.surface, borderRadius: 14, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
  lbl: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 10, padding: 12,
    fontSize: 14, color: colors.text,
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
  },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  typeBtnTextActive: { color: colors.white },
  uniChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  uniChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    backgroundColor: colors.primary + '15',
  },
  uniChipText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.inputBg, alignItems: 'center' },
  applyBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
});
