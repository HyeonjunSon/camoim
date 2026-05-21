import { useEffect, useState, useMemo } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { listSchoolMembers } from '../../lib/api';
import { toShortUniversityName } from '../../lib/university';
import Avatar from '../../components/common/Avatar';
import CustomHeader from '../../components/CustomHeader';

export default function SchoolMembersScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const { user } = useAuth();
  const styles = createStyles(colors);

  const [members, setMembers] = useState([]);
  const [leaderId, setLeaderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await listSchoolMembers();
        if (res.success) {
          setMembers(res.data || []);
          setLeaderId(res.leaderUserId ? String(res.leaderUserId) : null);
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return members;
    return members.filter(m => (m.nickname || '').toLowerCase().includes(s));
  }, [members, search]);

  return (
    <View style={styles.container}>
      <CustomHeader
        navigation={navigation}
        title={toShortUniversityName(user?.university) || t('mypage.school')}
      />
      <View style={styles.headerInfo}>
        <Ionicons name="people" size={14} color={colors.primary} />
        <Text style={styles.headerInfoText}>
          {t('schoolMembers.title')} · {members.length}
        </Text>
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={14} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('schoolMembers.searchPh')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('search.noResult')}</Text>
          }
          renderItem={({ item }) => {
            const isLeader = leaderId && String(item.id) === leaderId;
            const isMe = String(item.id) === String(user?.id);
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.75}
                onPress={() => navigation.push('UserProfile', { userId: String(item.id) })}
              >
                <Avatar nickname={item.nickname} uri={item.avatarUrl} size={38} showLetter />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{item.nickname}</Text>
                    {isLeader && (
                      <View style={styles.leaderBadge}>
                        <Ionicons name="star" size={9} color={colors.primary} />
                        <Text style={styles.leaderText}>{t('board.leaderBadge')}</Text>
                      </View>
                    )}
                    {isMe && (
                      <View style={styles.meBadge}>
                        <Text style={styles.meBadgeText}>{t('schoolMembers.me')}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },
  headerInfoText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, height: 42,
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 66 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.background,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1 },
  leaderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    backgroundColor: colors.primary + '18',
  },
  leaderText: { fontSize: 9, fontWeight: '800', color: colors.primary },
  meBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    backgroundColor: colors.inputBg,
  },
  meBadgeText: { fontSize: 9, fontWeight: '700', color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 60, fontSize: 13 },
});
