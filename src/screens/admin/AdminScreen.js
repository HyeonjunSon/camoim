import { useState, useCallback } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { adminGetStats } from '../../lib/api';

// 관리자 허브 — 모든 관리 도구의 진입점
export default function AdminScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminGetStats();
      if (res.success) setStats(res.data);
    } catch {} finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const Tile = ({ icon, label, badge, onPress, color = colors.primary }) => (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.tileIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const StatCard = ({ label, value, sub }) => (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value ?? '-'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>관리자</Text>
        <Text style={styles.subtitle}>CaMoim 운영 도구</Text>
      </View>

      {/* 핵심 지표 */}
      <View style={styles.statRow}>
        <StatCard label="활성 유저" value={stats?.users?.active} sub={`전체 ${stats?.users?.total ?? 0}`} />
        <StatCard label="신규 (24h)" value={stats?.signups?.d1} sub={`주간 ${stats?.signups?.d7 ?? 0}`} />
      </View>
      <View style={styles.statRow}>
        <StatCard label="게시글" value={stats?.content?.posts} sub={`24h ${stats?.posts?.d1 ?? 0}`} />
        <StatCard label="댓글" value={stats?.content?.comments} />
      </View>

      {/* 미처리 작업 */}
      <Text style={styles.sectionLabel}>처리 대기</Text>
      <View style={styles.grid}>
        <Tile
          icon="alert-circle"
          label="신고 처리"
          badge={stats?.pending?.reports}
          color="#EF4444"
          onPress={() => navigation.navigate('AdminReports')}
        />
        <Tile
          icon="school"
          label="학교 인증"
          badge={stats?.pending?.verify}
          color="#F59E0B"
          onPress={() => navigation.navigate('AdminVerify')}
        />
        <Tile
          icon="mail"
          label="문의 응대"
          badge={stats?.pending?.inquiry}
          color="#3B82F6"
          onPress={() => navigation.navigate('AdminInquiries')}
        />
      </View>

      {/* 사용자/콘텐츠 */}
      <Text style={styles.sectionLabel}>사용자 · 콘텐츠</Text>
      <View style={styles.grid}>
        <Tile icon="people" label="유저 관리" onPress={() => navigation.navigate('AdminUsers')} />
        <Tile icon="document-text" label="게시글 관리" onPress={() => navigation.navigate('AdminPosts')} />
        <Tile icon="grid" label="게시판 관리" onPress={() => navigation.navigate('AdminBoards')} />
      </View>

      {/* 운영 */}
      <Text style={styles.sectionLabel}>운영</Text>
      <View style={styles.grid}>
        <Tile icon="megaphone" label="공지 / 푸시" onPress={() => navigation.navigate('AdminBroadcast')} />
        <Tile icon="settings" label="시스템 설정" onPress={() => navigation.navigate('AdminSystem')} />
        <Tile icon="time" label="활동 로그" onPress={() => navigation.navigate('AdminLogs')} />
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontWeight: '600' },
  statSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary,
    paddingHorizontal: 20, marginTop: 20, marginBottom: 10,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16,
    justifyContent: 'space-between', rowGap: 10,
  },
  tile: {
    width: '32%', backgroundColor: colors.surface, borderRadius: 14,
    padding: 14, alignItems: 'center', position: 'relative',
  },
  tileIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  tileLabel: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  badge: {
    position: 'absolute', top: 8, right: 8, backgroundColor: colors.danger,
    borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.white },
});
