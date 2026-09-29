import { useState, useCallback, useMemo } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Switch,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import {
  adminListUniversities,
  adminCreateUniversity,
  adminUpdateUniversity,
  adminDeleteUniversity,
} from '../../lib/api';
import { useLang } from '../../context/LangContext';

export default function AdminUniversitiesScreen() {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit', id?: string }
  const [form, setForm] = useState({ name: '', fullName: '', sortOrder: 0, active: true });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListUniversities();
      if (res.success) setItems(res.data ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(u =>
      (u.name || '').toLowerCase().includes(s) || (u.fullName || '').toLowerCase().includes(s)
    );
  }, [items, search]);

  const openCreate = () => {
    setForm({ name: '', fullName: '', sortOrder: items.length + 1, active: true });
    setModal({ mode: 'create' });
  };

  const openEdit = (u) => {
    setForm({
      name: u.name || '',
      fullName: u.fullName || '',
      sortOrder: u.sortOrder ?? 0,
      active: u.active !== false,
    });
    setModal({ mode: 'edit', id: u.id });
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) return Alert.alert(t('admin.uniNameRequired'));
    try {
      if (modal.mode === 'create') {
        await adminCreateUniversity({
          name,
          fullName: form.fullName.trim() || name,
          sortOrder: Number(form.sortOrder) || 0,
          active: form.active,
        });
      } else {
        await adminUpdateUniversity(modal.id, {
          name,
          fullName: form.fullName.trim() || name,
          sortOrder: Number(form.sortOrder) || 0,
          active: form.active,
        });
      }
      setModal(null);
      load();
    } catch (e) {
      Alert.alert(t('admin.uniFailed'), e.message || t('common.error'));
    }
  };

  const onDelete = (u) => {
    Alert.alert(
      t('admin.uniDeleteTitle'),
      t('admin.uniDeleteMsg').replace('{name}', u.name),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try { await adminDeleteUniversity(u.id); load(); }
            catch (e) { Alert.alert(t('admin.uniFailed'), e.message); }
          },
        },
      ]
    );
  };

  if (loading && items.length === 0) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('admin.uniSearchPh')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={openCreate}>
          <Text style={styles.createText}>＋</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.name}>{item.name}</Text>
                {!item.active && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>{t('admin.uniInactive')}</Text>
                  </View>
                )}
              </View>
              {item.fullName && item.fullName !== item.name && (
                <Text style={styles.fullName}>{item.fullName}</Text>
              )}
              <Text style={styles.meta}>{t('admin.boardSortLabel')} {item.sortOrder}</Text>
            </View>
            <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
              <Text style={styles.editText}>{t('common.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(item)} style={styles.delBtn}>
              <Ionicons name="trash" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('search.noResult')}</Text>
        }
      />

      <Modal visible={!!modal} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={{ padding: 18 }}>
              <Text style={styles.modalTitle}>
                {modal?.mode === 'create' ? t('admin.uniCreate') : t('admin.uniEdit')}
              </Text>

              <Text style={styles.lbl}>{t('admin.uniName')}</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                placeholder="University of Toronto (UofT)"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.lbl}>{t('admin.uniFullName')}</Text>
              <TextInput
                style={styles.input}
                value={form.fullName}
                onChangeText={(v) => setForm({ ...form, fullName: v })}
                placeholder="University of Toronto"
                placeholderTextColor={colors.textSecondary}
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

              <View style={styles.switchRow}>
                <Text style={{ color: colors.text, fontSize: 14 }}>{t('admin.uniActive')}</Text>
                <Switch
                  value={form.active}
                  onValueChange={(v) => setForm({ ...form, active: v })}
                />
              </View>

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

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, marginTop: 8, padding: 12,
    borderRadius: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  fullName: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  inactiveBadge: {
    backgroundColor: colors.inputBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  inactiveBadgeText: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
  editBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: colors.primary + '15', borderRadius: 8,
  },
  editText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  delBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEE2E2', borderRadius: 8,
  },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },

  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: colors.background, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 14 },
  lbl: { fontSize: 12, color: colors.textSecondary, marginTop: 10, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingHorizontal: 4,
  },
  modalActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20,
  },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  applyBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.primary,
  },
});
