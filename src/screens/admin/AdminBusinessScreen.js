import { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '../../components/StyledText';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { catOf, cityLabelOf, sourceLabelOf } from '../../constants/businesses';
import { adminListBusinesses, adminUpdateBusiness, adminDeleteBusiness, startChat } from '../../lib/api';

// 관리자 — 한인 업체 승인/관리
export default function AdminBusinessScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [list, setList] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await adminListBusinesses();
      if (res.success) {
        setList(res.data || []);
        setCounts(res.counts || { pending: 0, approved: 0, rejected: 0 });
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setStatus = async (biz, status) => {
    setBusyId(biz.id);
    try {
      const res = await adminUpdateBusiness(biz.id, { status });
      if (res.success) await load();
    } catch (e) {
      Alert.alert('오류', e?.message || '처리에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  // 제보자에게 바로 DM 걸기 (관리자 → 유저)
  const openChat = async (biz) => {
    if (!biz.submittedBy) {
      Alert.alert('알림', '제보자 정보가 없는 업체예요.');
      return;
    }
    setBusyId(biz.id);
    try {
      const res = await startChat(biz.submittedBy);
      if (res.success) {
        navigation.navigate('ChatRoom', { roomId: res.data.id, other: res.data.other });
      } else {
        Alert.alert('오류', res.message || '채팅을 시작할 수 없어요.');
      }
    } catch (e) {
      Alert.alert('오류', e?.message || '채팅을 시작할 수 없어요.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (biz) => {
    Alert.alert('업체 삭제', `"${biz.name}"을(를) 삭제할까요? 되돌릴 수 없어요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setBusyId(biz.id);
          try {
            const res = await adminDeleteBusiness(biz.id);
            if (res.success) await load();
          } catch (e) {
            Alert.alert('오류', e?.message || '삭제에 실패했어요.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const pending = list.filter((b) => b.status === 'pending');
  const others = list.filter((b) => b.status !== 'pending');

  return (
    <View style={styles.container}>
      <CustomHeader navigation={navigation} title="업체 관리" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* 통계 */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatCard value={counts.pending} label="승인 대기" color="#F59E0B" colors={colors} />
          <StatCard value={counts.approved} label="운영 중" color="#7F77DD" colors={colors} />
          <StatCard value={counts.rejected} label="거절" color={colors.textSecondary} colors={colors} />
        </View>

        {loading ? (
          <View style={{ paddingTop: 40 }}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <>
            {/* 승인 대기 */}
            <View style={{ gap: 8 }}>
              <Text style={styles.sectionTitle}>⏳ 승인 대기</Text>
              {pending.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>대기 중인 정보가 없어요</Text></View>
              ) : (
                pending.map((b) => {
                  const c = catOf(b.category);
                  return (
                    <View key={b.id} style={styles.pendingCard}>
                      <View style={styles.rowTop}>
                        <View style={[styles.emojiBox, { backgroundColor: c.soft, width: 40, height: 40 }]}>
                          <Text style={{ fontSize: 19 }}>{c.emoji}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <View style={styles.rowCenter}>
                            <Text style={styles.nameText} numberOfLines={1}>{b.name}</Text>
                            <View style={[styles.catChip, { backgroundColor: c.soft }]}>
                              <Text style={[styles.catChipText, { color: c.color }]}>{c.label}</Text>
                            </View>
                          </View>
                          <Text style={styles.subText} numberOfLines={1}>{b.address} · {cityLabelOf(b.city)}</Text>
                          <Text style={styles.subTextSmall}>제보자 · {b.submitterNickname || '유저'}{!b.hasLocation ? '  · ⚠︎ 좌표 없음' : ''}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={[styles.actBtn, styles.approveBtn]} activeOpacity={0.85} disabled={busyId === b.id} onPress={() => setStatus(b, 'approved')}>
                          <Text style={styles.approveText}>승인</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actBtn, styles.rejectBtn]} activeOpacity={0.85} disabled={busyId === b.id} onPress={() => setStatus(b, 'rejected')}>
                          <Text style={styles.rejectText}>거절</Text>
                        </TouchableOpacity>
                        {b.submittedBy ? (
                          <TouchableOpacity style={[styles.actBtn, styles.chatBtn, { flex: 0, paddingHorizontal: 14 }]} activeOpacity={0.85} disabled={busyId === b.id} onPress={() => openChat(b)}>
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* 전체 업체 */}
            <View style={{ gap: 8 }}>
              <Text style={styles.sectionTitle}>전체 업체</Text>
              <View style={styles.listCard}>
                {others.length === 0 ? (
                  <View style={{ padding: 22 }}><Text style={styles.emptyText}>등록된 업체가 없어요</Text></View>
                ) : (
                  others.map((b, i) => {
                    const c = catOf(b.category);
                    const rejected = b.status === 'rejected';
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.listRow, i > 0 && styles.rowBorder, { opacity: rejected ? 0.55 : 1 }]}
                        activeOpacity={0.7}
                        onLongPress={() => confirmDelete(b)}
                        onPress={() => navigation.navigate('AdminBusinessEdit', { business: b })}
                      >
                        <View style={[styles.emojiBox, { backgroundColor: c.soft, width: 34, height: 34 }]}>
                          <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowName} numberOfLines={1}>{b.name}</Text>
                          <Text style={styles.subTextSmall}>{cityLabelOf(b.city)} · {sourceLabelOf(b.source)}{!b.hasLocation ? '  · ⚠︎ 좌표 없음' : ''}</Text>
                        </View>
                        {b.submittedBy ? (
                          <TouchableOpacity style={styles.rowChatBtn} activeOpacity={0.7} disabled={busyId === b.id} onPress={() => openChat(b)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                          </TouchableOpacity>
                        ) : null}
                        <View style={[styles.statusChip, rejected ? styles.statusRejected : styles.statusActive]}>
                          <Text style={[styles.statusText, { color: rejected ? colors.textSecondary : '#2D9E5A' }]}>
                            {rejected ? '거절됨' : '영업중'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
              <Text style={styles.hintText}>탭하면 편집(상태·정보·좌표·사진 모두) · 길게 눌러 삭제</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ value, label, color, colors }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 2 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: colors.textSecondary },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 22, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  pendingCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emojiBox: { borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  nameText: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  subText: { fontSize: 12, color: colors.textSecondary },
  subTextSmall: { fontSize: 11, color: colors.textSecondary },
  catChip: { paddingVertical: 1, paddingHorizontal: 7, borderRadius: 999 },
  catChipText: { fontSize: 10, fontWeight: '700' },
  actBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  approveBtn: { backgroundColor: '#E8FFF1' },
  approveText: { fontSize: 13, fontWeight: '700', color: '#2D9E5A' },
  rejectBtn: { backgroundColor: '#FEF2F2' },
  rejectText: { fontSize: 13, fontWeight: '700', color: '#FF4444' },
  chatBtn: { backgroundColor: colors.inputBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rowChatBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  listCard: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowName: { fontSize: 13, fontWeight: '700', color: colors.text },
  statusChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  statusActive: { backgroundColor: '#E8FFF1' },
  statusRejected: { backgroundColor: colors.inputBg },
  statusText: { fontSize: 11, fontWeight: '700' },
  hintText: { fontSize: 11, color: colors.textSecondary, paddingHorizontal: 4 },
});
