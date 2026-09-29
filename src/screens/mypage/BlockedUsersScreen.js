import { useState, useCallback } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { getMyBlocks, unblockUser } from '../../lib/api';
import Avatar from '../../components/common/Avatar';

function formatDate(str) {
  const d = new Date(str);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function BlockedUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMyBlocks();
      if (res.success) setBlocks(res.data);
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleUnblock = (item) => {
    Alert.alert('', `${item.nickname} ${t('block.unblock')}?`, [
      { text: t('block.cancel'), style: 'cancel' },
      {
        text: t('block.unblock'),
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await unblockUser(item.blockedId);
            if (res.success) {
              setBlocks(prev => prev.filter(b => String(b.blockedId) !== String(item.blockedId)));
            }
          } catch (e) {
            Alert.alert(t('common.error'), t('block.failed'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={blocks}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={blocks.length === 0 && { flex: 1, justifyContent: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListEmptyComponent={
        <Text style={styles.empty}>{t('block.noBlocked')}</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.userArea}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('UserProfile', { userId: item.blockedId })}
          >
            <Avatar nickname={item.nickname} uri={item.avatarUrl} size={44} showLetter />
            <View style={{ flex: 1 }}>
              <Text style={styles.nick}>{item.nickname}</Text>
              <View style={styles.tagRow}>
                {item.blockChat && <Text style={styles.tag}><Ionicons name="chatbubble" size={10} color={colors.textSecondary} /> {t('block.optChat')}</Text>}
                {item.hideContent && <Text style={styles.tag}><Ionicons name="eye-off" size={10} color={colors.textSecondary} /> {t('block.optHide')}</Text>}
              </View>
              <Text style={styles.date}>{t('block.since')} {formatDate(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.unblockBtn} onPress={() => handleUnblock(item)}>
            <Text style={styles.unblockText}>{t('block.unblock')}</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  userArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nick: { fontSize: 15, fontWeight: '700', color: colors.text },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 3 },
  tag: { fontSize: 11, color: colors.textSecondary },
  date: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.danger + '15', borderRadius: 8,
  },
  unblockText: { fontSize: 12, fontWeight: '600', color: colors.danger },
});
