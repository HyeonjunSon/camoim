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
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import CustomHeader from '../../components/CustomHeader';
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

  // Check whether we are inside AdminStack (the NoticeEdit screen exists only there)
  const navState = navigation.getState();
  const isInAdminStack = navState?.routes?.some(r => r.name?.startsWith('Admin'));

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const showAdminActions = isAdmin && notice && isInAdminStack;
  const headerEl = (
    <CustomHeader
      navigation={navigation}
      title={t('nav.noticeDetail')}
      rightActions={showAdminActions ? [
        { icon: 'create-outline', onPress: () => navigation.navigate('NoticeEdit', { notice }), color: colors.primary, label: t('common.edit') },
        { icon: 'trash-outline', onPress: handleDelete, color: colors.danger ?? '#E64545', label: t('common.delete') },
      ] : []}
    />
  );

  if (loading || !notice) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {headerEl}
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    {headerEl}
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {notice.pinned && <Text style={styles.pinTag}>{t('notice.pinned')}</Text>}
      <Text selectable style={styles.title}>{notice.title}</Text>
      <Text style={styles.meta}>{notice.author ?? t('roles.admin')} · {formatDateTime(notice.createdAt)}</Text>
      <View style={styles.divider} />
      <Text selectable style={styles.body}>{notice.content}</Text>
    </ScrollView>
    </View>
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
