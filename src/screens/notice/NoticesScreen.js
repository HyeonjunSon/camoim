import { useState, useCallback, useLayoutEffect } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { getNotices } from '../../lib/api';

function formatDate(str) {
  const d = new Date(str);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function NoticesScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getNotices();
      if (res.success) setNotices(res.data);
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: isAdmin ? () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('NoticeEdit', {})}
          hitSlop={10}
          style={{ paddingHorizontal: 6 }}
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      ) : undefined,
    });
  }, [navigation, isAdmin]);

  const isNew = (createdAt) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      data={notices}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={notices.length === 0 ? { flex: 1, justifyContent: 'center' } : { paddingVertical: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListEmptyComponent={<Text style={styles.empty}>{t('notice.empty')}</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('NoticeDetail', { id: item.id })}
        >
          <View style={styles.tagRow}>
            {item.pinned && <Text style={styles.pinTag}>{t('notice.pinned')}</Text>}
            {isNew(item.createdAt) && <Text style={styles.newTag}>{t('notice.new')}</Text>}
          </View>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.preview} numberOfLines={2}>{item.content}</Text>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginVertical: 5,
  },
  tagRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  pinTag: {
    fontSize: 10, fontWeight: '700', color: colors.primary,
    backgroundColor: colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  newTag: {
    fontSize: 10, fontWeight: '700', color: '#EF4444',
    backgroundColor: colors.danger + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 22 },
  preview: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 19 },
  date: { fontSize: 11, color: colors.textSecondary, marginTop: 8 },
});
