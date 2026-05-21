import { useEffect, useState } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import {
  getSchoolCommunity,
  updateSchoolCommunity,
  searchSchoolMembers,
  transferSchoolLeader,
  resignSchoolLeader,
} from '../../lib/api';
import Avatar from '../../components/common/Avatar';
import CustomHeader from '../../components/CustomHeader';

const FIELDS = [
  { key: 'instagram', icon: 'logo-instagram', color: '#E1306C', labelKey: 'community.instagram', placeholder: 'instagram.com/...' },
  { key: 'kakaoOpen', icon: 'chatbubble-ellipses', color: '#FAE100', labelKey: 'community.kakaoOpen', placeholder: 'open.kakao.com/o/...' },
  { key: 'discord', icon: 'logo-discord', color: '#5865F2', labelKey: 'community.discord', placeholder: 'discord.gg/...' },
  { key: 'homepage', icon: 'globe', color: '#10B981', labelKey: 'community.homepage', placeholder: 'example.com' },
];

export default function SchoolCommunityEditScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [form, setForm] = useState({ instagram: '', kakaoOpen: '', discord: '', homepage: '', notice: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isLeader, setIsLeader] = useState(false);

  // 인수인계 picker 상태
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerMembers, setPickerMembers] = useState([]);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getSchoolCommunity();
        if (res.success) {
          setCanEdit(!!res.data?.canEdit);
          setIsLeader(!!res.data?.isLeader);
          const c = res.data?.community || {};
          setForm({
            instagram: c.instagram || '',
            kakaoOpen: c.kakaoOpen || '',
            discord: c.discord || '',
            homepage: c.homepage || '',
            notice: c.notice || '',
          });
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  // picker 열렸을 때 검색어 변경마다 멤버 로드 (debounce 없이 — 입력 적고 즉시반응 가치 더 큼)
  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    setPickerLoading(true);
    searchSchoolMembers(pickerSearch, 50)
      .then(res => {
        if (cancelled) return;
        if (res.success) setPickerMembers(res.data || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPickerLoading(false); });
    return () => { cancelled = true; };
  }, [pickerOpen, pickerSearch]);

  const onSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await updateSchoolCommunity(form);
      if (res.success) {
        navigation.goBack();
      } else {
        Alert.alert(t('common.error'), res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('common.serverError'));
    } finally {
      setSaving(false);
    }
  };

  const onPickMember = (member) => {
    Alert.alert(
      t('board.leaderTransferConfirmTitle'),
      t('board.leaderTransferConfirmMsg').replace('{name}', member.nickname),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('board.leaderTransferConfirmBtn'),
          style: 'destructive',
          onPress: async () => {
            setTransferring(true);
            try {
              const res = await transferSchoolLeader(member.id);
              if (res.success) {
                setPickerOpen(false);
                Alert.alert(t('common.done'), t('board.leaderTransferred').replace('{name}', member.nickname));
                navigation.goBack();
              } else {
                Alert.alert(t('common.error'), res.message || t('common.serverError'));
              }
            } catch (e) {
              Alert.alert(t('common.error'), e.message || t('common.serverError'));
            } finally {
              setTransferring(false);
            }
          },
        },
      ]
    );
  };

  const onResign = () => {
    Alert.alert(
      t('board.leaderResignTitle'),
      t('board.leaderResignMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('board.leaderResignBtn'),
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await resignSchoolLeader();
              if (res.success) {
                Alert.alert(t('common.done'), t('board.leaderResigned'));
                navigation.goBack();
              } else {
                Alert.alert(t('common.error'), res.message || t('common.serverError'));
              }
            } catch (e) {
              Alert.alert(t('common.error'), e.message || t('common.serverError'));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!canEdit) {
    return (
      <View style={styles.container}>
        <CustomHeader navigation={navigation} title={t('board.communityEditTitle')} />
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={32} color={colors.textSecondary} />
          <Text style={styles.lockText}>{t('board.communityNoPerm')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader
        navigation={navigation}
        title={t('board.communityEditTitle')}
        rightActions={[
          { text: saving ? '...' : t('common.save'), onPress: saving ? undefined : onSave, disabled: saving, label: t('common.save') },
        ]}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>{t('board.communityEditHint')}</Text>

          <Text style={styles.sectionLabel}>{t('community.notice')}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={form.notice}
            onChangeText={(v) => setForm({ ...form, notice: v })}
            placeholder={t('community.noticePh')}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
          />
          <Text style={styles.count}>{form.notice.length}/500</Text>

          <Text style={styles.sectionLabel}>{t('community.linksLabel')}</Text>
          {FIELDS.map(f => (
            <View key={f.key} style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Ionicons name={f.icon} size={16} color={f.color} />
                <Text style={styles.fieldLabel}>{t(f.labelKey)}</Text>
              </View>
              <TextInput
                style={styles.input}
                value={form[f.key]}
                onChangeText={(v) => setForm({ ...form, [f.key]: v })}
                placeholder={f.placeholder}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
                maxLength={300}
              />
            </View>
          ))}

          {/* 학생회장 권한 — 실제 학생회장에게만 노출 (admin은 canEdit이지만 isLeader는 false) */}
          {isLeader && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>{t('board.leaderActionsTitle')}</Text>
              <Text style={styles.leaderHint}>{t('board.leaderActionsHint')}</Text>

              <TouchableOpacity
                style={styles.leaderBtn}
                onPress={() => setPickerOpen(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                <Text style={styles.leaderBtnText}>{t('board.leaderTransferBtn')}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.leaderBtn, styles.leaderBtnDanger]}
                onPress={onResign}
                activeOpacity={0.85}
              >
                <Ionicons name="log-out-outline" size={16} color="#EF4444" />
                <Text style={[styles.leaderBtnText, { color: '#EF4444' }]}>{t('board.leaderResignBtn')}</Text>
                <Ionicons name="chevron-forward" size={16} color="#EF4444" />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 인수인계 picker modal */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => !transferring && setPickerOpen(false)}
      >
        <View style={styles.pickerRoot}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{t('board.leaderTransferTitle')}</Text>
              <TouchableOpacity onPress={() => !transferring && setPickerOpen(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerSearchRow}>
              <Ionicons name="search" size={14} color={colors.textSecondary} />
              <TextInput
                style={styles.pickerSearchInput}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder={t('board.leaderTransferSearchPh')}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>
            {pickerLoading ? (
              <View style={{ padding: 24 }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={pickerMembers}
                keyExtractor={(m) => String(m.id)}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.pickerEmpty}>{t('board.leaderTransferEmpty')}</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => onPickMember(item)}
                    activeOpacity={0.75}
                    disabled={transferring}
                  >
                    <Avatar nickname={item.nickname} uri={item.avatarUrl} size={32} showLetter />
                    <Text style={styles.pickerItemName}>{item.nickname}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  lockText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, lineHeight: 17 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 8, marginBottom: 8 },
  count: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
  fieldBlock: { marginBottom: 14 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },

  leaderHint: { fontSize: 11, color: colors.textSecondary, marginBottom: 10, lineHeight: 15 },
  leaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  leaderBtnDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  leaderBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },

  // picker modal
  pickerRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerCard: {
    backgroundColor: colors.background, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    maxHeight: '85%', minHeight: 300,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10,
  },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  pickerSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 12, height: 40,
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  pickerSearchInput: { flex: 1, fontSize: 13, color: colors.text },
  pickerEmpty: { padding: 28, textAlign: 'center', color: colors.textSecondary, fontSize: 12 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  pickerItemName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
});
