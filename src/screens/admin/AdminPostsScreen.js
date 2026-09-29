import { useState, useEffect, useCallback, useMemo } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { adminListPosts, adminHidePost, adminPinPost, adminDeletePost, adminListBoards } from '../../lib/api';
import { useLang } from '../../context/LangContext';
import { getBoardName } from '../../lib/i18n';

export default function AdminPostsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);
  const chipStyles = createChipStyles(colors);

  const HIDDEN_TABS = [
    { key: '',      label: t('admin.ptAll') },
    { key: 'false', label: t('admin.ptVisible') },
    { key: 'true',  label: t('admin.ptHidden') },
  ];

  const SCOPES = [
    { key: 'global', label: t('admin.ptGlobal') },
    { key: 'uni',    label: t('admin.ptSchool') },
  ];

  const [q, setQ] = useState('');
  const [hidden, setHidden] = useState('');
  const [scope, setScope] = useState('global');
  const [boards, setBoards] = useState([]);
  const [globalBoardId, setGlobalBoardId] = useState('');
  const [uni, setUni] = useState(null);
  const [uniBoardId, setUniBoardId] = useState('');
  const [uniPickerOpen, setUniPickerOpen] = useState(false);
  const [uniSearch, setUniSearch] = useState('');

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminListBoards();
        if (res.success) setBoards(res.data || []);
      } catch {}
    })();
  }, []);

  const globalBoards = useMemo(
    () => boards.filter(b => !b.isUniversityBoard).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [boards]
  );
  const uniBoards = useMemo(() => boards.filter(b => b.isUniversityBoard), [boards]);
  const universities = useMemo(() => {
    const set = new Set();
    uniBoards.forEach(b => b.university && set.add(b.university));
    return Array.from(set).sort();
  }, [uniBoards]);
  const currentUniBoards = useMemo(
    () => uniBoards.filter(b => b.university === uni).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [uniBoards, uni]
  );

  const filterParams = useMemo(() => {
    if (scope === 'global') {
      return globalBoardId
        ? { boardId: globalBoardId }
        : { boardIds: globalBoards.map(b => b.id).join(',') };
    }
    if (!uni) return { boardIds: '__none__' };
    if (uniBoardId) return { boardId: uniBoardId };
    return { boardIds: currentUniBoards.map(b => b.id).join(',') };
  }, [scope, globalBoardId, uni, uniBoardId, globalBoards, currentUniBoards]);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const nextPage = reset ? 1 : page;
      const res = await adminListPosts({ q, hidden, page: nextPage, ...filterParams });
      if (res.success) {
        setItems(reset ? res.data.posts : [...items, ...res.data.posts]);
        setPages(res.data.pages);
        setPage(nextPage);
      }
    } catch {} finally { setLoading(false); }
  }, [q, hidden, page, items, filterParams]);

  useEffect(() => {
    const id = setTimeout(() => { setPage(1); load(true); }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [q, hidden, scope, globalBoardId, uni, uniBoardId, boards.length]);

  const filteredUniversities = useMemo(() => {
    const s = uniSearch.trim().toLowerCase();
    if (!s) return universities;
    return universities.filter(u => u.toLowerCase().includes(s));
  }, [universities, uniSearch]);

  const toggleHide = async (item) => {
    try { await adminHidePost(item.id, !item.hidden, ''); load(true); } catch {}
  };

  const togglePin = async (item) => {
    try { await adminPinPost(item.id, !item.pinned); load(true); } catch {}
  };

  const onDelete = (item) => {
    Alert.alert(t('admin.ptDeleteTitle'), t('admin.ptDeleteAsk'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try { await adminDeletePost(item.id); load(true); } catch {}
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder={t('admin.ptSearchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.scopeBar}>
        {SCOPES.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.scopeBtn, scope === s.key && styles.scopeBtnActive]}
            onPress={() => setScope(s.key)}
          >
            <Text style={[styles.scopeText, scope === s.key && styles.scopeTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {scope === 'global' && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
          data={[{ id: '__all__', name: t('admin.ptAll') }, ...globalBoards]}
          keyExtractor={(b) => String(b.id)}
          renderItem={({ item: b }) => (
            <Chip
              chipStyles={chipStyles}
              active={b.id === '__all__' ? !globalBoardId : globalBoardId === b.id}
              label={b.id === '__all__' ? b.name : getBoardName(b.slug, b.name, t)}
              onPress={() => setGlobalBoardId(b.id === '__all__' ? '' : b.id)}
            />
          )}
        />
      )}

      {scope === 'uni' && (
        <View>
          <TouchableOpacity style={styles.uniSelector} onPress={() => setUniPickerOpen(true)}>
            <Ionicons name="school" size={16} color={colors.primary} />
            <Text style={styles.uniSelectorText}>{uni || t('admin.ptSelectSchool')}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          {uni && (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
              data={[{ id: '__all__', name: t('admin.ptAll') }, ...currentUniBoards]}
              keyExtractor={(b) => String(b.id)}
              renderItem={({ item: b }) => (
                <Chip
                  chipStyles={chipStyles}
                  active={b.id === '__all__' ? !uniBoardId : uniBoardId === b.id}
                  label={b.id === '__all__' ? b.name : getBoardName(b.slug, b.name, t)}
                  onPress={() => setUniBoardId(b.id === '__all__' ? '' : b.id)}
                />
              )}
            />
          )}
        </View>
      )}

      <View style={styles.tabBar}>
        {HIDDEN_TABS.map(tb => (
          <TouchableOpacity
            key={tb.key || 'all'}
            style={[styles.tab, hidden === tb.key && styles.tabActive]}
            onPress={() => setHidden(tb.key)}
          >
            <Text style={[styles.tabText, hidden === tb.key && styles.tabTextActive]}>{tb.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={uniPickerOpen} transparent animationType="slide" onRequestClose={() => setUniPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('admin.ptSchoolSelect')}</Text>
            <TextInput
              style={styles.uniSearchInput}
              value={uniSearch}
              onChangeText={setUniSearch}
              placeholder={t('admin.ptSchoolSearch')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
            <FlatList
              data={filteredUniversities}
              keyExtractor={(u) => u}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>{t('admin.ptNoSchool')}</Text>}
              renderItem={({ item: u }) => (
                <TouchableOpacity
                  style={styles.uniRow}
                  onPress={() => { setUni(u); setUniBoardId(''); setUniPickerOpen(false); setUniSearch(''); }}
                >
                  <Text style={styles.uniRowText}>{u}</Text>
                  {uni === u && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setUniPickerOpen(false)}>
              <Text style={{ color: colors.textSecondary }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ padding: 12, paddingTop: 8, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && page < pages) {
            setPage(page + 1);
            load(false);
          }
        }}
        ListEmptyComponent={!loading && <Text style={styles.empty}>{t('admin.ptNoPosts')}</Text>}
        ListFooterComponent={loading && <ActivityIndicator color={colors.primary} style={{ margin: 16 }} />}
        renderItem={({ item }) => (
          <View style={[styles.card, item.hidden && { opacity: 0.5 }]}>
            <View style={styles.row}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Home', { screen: 'PostDetail', params: { postId: item.id } })}
              >
                <Text style={styles.title} numberOfLines={2}>
                  {item.pinned && <Ionicons name="pin" size={12} color="#EF4444" />}{item.pinned ? ' ' : ''}{item.title}
                </Text>
                <Text style={styles.meta}>
                  {item.boardId?.name} · {item.userId?.nickname} · {new Date(item.createdAt).toLocaleDateString()}
                </Text>
                <Text style={styles.stats}>
                  <Ionicons name="heart" size={11} color="#FF4444" /> {item.likeCount} · <Ionicons name="chatbubble" size={11} color={colors.textSecondary} /> {item.commentCount} · <Ionicons name="eye" size={11} color={colors.textSecondary} /> {item.viewCount ?? 0}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.smBtn} onPress={() => togglePin(item)}>
                <Text style={styles.smText}>{item.pinned ? t('admin.ptUnpin') : t('admin.ptPin')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smBtn} onPress={() => toggleHide(item)}>
                <Text style={styles.smText}>{item.hidden ? t('admin.ptShow') : t('admin.ptHide')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smBtn, styles.delBtn]} onPress={() => onDelete(item)}>
                <Text style={[styles.smText, { color: '#EF4444' }]}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function Chip({ active, label, onPress, chipStyles }) {
  return (
    <TouchableOpacity
      style={[chipStyles.chip, active && chipStyles.chipActive]}
      onPress={onPress}
    >
      <Text style={[chipStyles.chipText, active && chipStyles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const createChipStyles = (colors) => StyleSheet.create({
  chip: {
    paddingHorizontal: 14, height: 32, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    marginRight: 6, justifyContent: 'center', alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, lineHeight: 16, includeFontPadding: false },
  chipTextActive: { color: colors.white },
});

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.inputBg },
  scopeBar: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  scopeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  scopeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  scopeText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  scopeTextActive: { color: colors.white },
  chipScroll: { flexGrow: 0, marginBottom: 8 },
  chipRow: { paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  uniSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 14, height: 42,
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  uniSelectorText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, maxHeight: '80%',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
  uniSearchInput: {
    backgroundColor: colors.inputBg, borderRadius: 10, padding: 12, fontSize: 14,
    color: colors.text, marginBottom: 8,
  },
  uniRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.inputBg,
  },
  uniRowText: { fontSize: 14, color: colors.text },
  modalClose: { alignItems: 'center', padding: 14, marginTop: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, height: 42,
    backgroundColor: colors.surface, borderRadius: 10,
  },
  search: { flex: 1, fontSize: 14, color: colors.text },
  tabBar: { flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  tab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  card: { backgroundColor: colors.surface, padding: 12, borderRadius: 12, gap: 8 },
  row: { flexDirection: 'row' },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  stats: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  smBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.inputBg, alignItems: 'center',
  },
  delBtn: { backgroundColor: colors.danger + '15' },
  smText: { fontSize: 12, fontWeight: '600', color: colors.text },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 60 },
});
