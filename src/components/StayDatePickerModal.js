// 순수 JS 월 달력 모달 (네이티브 date picker 미설치 → OTA 안전)
// 입주 가능일 선택: 특정 날짜(YYYY-MM-DD) 또는 '즉시 입주 가능'(immediate)
import { useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';

const STAY_ACCENT = '#3B82F6';
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function StayDatePickerModal({ visible, value, onSelect, onClose, includeImmediate = true }) {
  const { colors } = useTheme();
  const { lang } = useLang();
  const styles = createStyles(colors);

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const init = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  const [vy, setVy] = useState(init ? Number(init.slice(0, 4)) : todayY);
  const [vm, setVm] = useState(init ? Number(init.slice(5, 7)) - 1 : todayM);

  const WEEK = lang === 'en' ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['일', '월', '화', '수', '목', '금', '토'];
  const MON = lang === 'en'
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : null;
  const monthLabel = lang === 'en' ? `${MON[vm]} ${vy}` : `${vy}년 ${vm + 1}월`;

  const firstWeekday = new Date(vy, vm, 1).getDay();       // 0=일
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => { if (vm === 0) { setVy(vy - 1); setVm(11); } else setVm(vm - 1); };
  const nextMonth = () => { if (vm === 11) { setVy(vy + 1); setVm(0); } else setVm(vm + 1); };
  // 과거(이번 달 이전) 이동 제한
  const canPrev = vy > todayY || (vy === todayY && vm > todayM);

  const isPast = (d) => vy < todayY || (vy === todayY && vm < todayM) || (vy === todayY && vm === todayM && d < todayD);
  const isToday = (d) => vy === todayY && vm === todayM && d === todayD;
  const isSel = (d) => init === iso(vy, vm, d);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1}>
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={canPrev ? prevMonth : undefined} disabled={!canPrev} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={canPrev ? colors.text : colors.border} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* 요일 */}
          <View style={styles.weekRow}>
            {WEEK.map((w, i) => (
              <Text key={i} style={[styles.weekText, i === 0 && { color: '#EF4444' }, i === 6 && { color: STAY_ACCENT }]}>{w}</Text>
            ))}
          </View>

          {/* 날짜 그리드 */}
          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={`b${i}`} style={styles.cell} />;
              const past = isPast(d);
              const sel = isSel(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={styles.cell}
                  activeOpacity={past ? 1 : 0.6}
                  disabled={past}
                  onPress={() => { onSelect(iso(vy, vm, d)); onClose(); }}
                >
                  <View style={[styles.dayWrap, sel && styles.daySelected, !sel && isToday(d) && styles.dayToday]}>
                    <Text style={[styles.dayText, past && { color: colors.border }, sel && { color: '#FFFFFF', fontWeight: '800' }]}>{d}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {includeImmediate && (
            <TouchableOpacity style={styles.immediateBtn} activeOpacity={0.85} onPress={() => { onSelect('immediate'); onClose(); }}>
              <Ionicons name="flash" size={15} color={STAY_ACCENT} />
              <Text style={styles.immediateText}>{lang === 'en' ? 'Available now' : '즉시 입주 가능'}</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: 18, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 12 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  weekRow: { flexDirection: 'row' },
  weekText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.textSecondary, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: STAY_ACCENT },
  dayToday: { borderWidth: 1.5, borderColor: STAY_ACCENT },
  dayText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  immediateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginTop: 12, paddingVertical: 13, borderRadius: 12, backgroundColor: STAY_ACCENT + '12',
  },
  immediateText: { fontSize: 14, fontWeight: '700', color: STAY_ACCENT },
});
