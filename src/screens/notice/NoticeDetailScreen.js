import { useState, useEffect, useLayoutEffect } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { getNotice, deleteNotice } from '../../lib/api';

function formatDateTime(str) {
  const d = new Date(str);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function NoticeDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const id = route.params?.id ?? route.params?.noticeId;
  const { t } = useLang();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await getNotice(id);
      if (res.success) setNotice(res.data);
      else throw new Error(res.message);
    } catch (e) {
      Alert.alert(t('common.error'), e.message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleDelete = () => {
    Alert.alert('', t('notice.deleteAsk'), [
      { text: t('notice.cancel'), style: 'cancel' },
      {
        text: t('notice.deleteBtn'),
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteNotice(id);
            if (res.success) {
              Alert.alert('', t('notice.deleted'));
              navigation.goBack();
            }
          } catch (e) {
            Alert.alert(t('common.error'), e.message);
          }
        },
      },
    ]);
  };

  // AdminStack 안에 있는지 확인 (NoticeEdit 화면이 AdminStack에만 있으므로)
  const navState = navigation.getState();
  const isInAdminStack = navState?.routes?.some(r => r.name?.startsWith('Admin'));

  useLayoutEffect(() => {
    if (!isAdmin || !notice || !isInAdminStack) return;
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 6 }}>
          <TouchableOpacity onPress={() => navigation.navigate('NoticeEdit', { notice })} hitSlop={10}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color={colors.danger ?? '#E64545'} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, isAdmin, notice, isInAdminStack]);

  if (loading || !notice) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {notice.pinned && <Text style={styles.pinTag}>{t('notice.pinned')}</Text>}
      <Text style={styles.title}>{notice.title}</Text>
      <Text style={styles.meta}>{notice.author ?? t('roles.admin')} · {formatDateTime(notice.createdAt)}</Text>
      <View style={styles.divider} />
      <Text style={styles.body}>{notice.content}</Text>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  pinTag: {
    alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: colors.primary,
    backgroundColor: colors.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, lineHeight: 28 },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  divider: { height: 0.5, backgroundColor: colors.border, marginVertical: 16 },
  body: { fontSize: 15, lineHeight: 24, color: colors.text },
});
