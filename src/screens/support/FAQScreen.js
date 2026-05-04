import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Text } from '../../components/StyledText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useLang } from '../../context/LangContext';

// 그룹 → 질문 ID 매핑 (질문 ID는 i18n faq.qN / faq.aN 와 매칭)
const GROUPS = [
  { key: 'g_account', items: ['1', '11', '12', '2', '13', '3'] },
  { key: 'g_post',    items: ['4', '14', '15', '16', '5'] },
  { key: 'g_block',   items: ['6', '7', '8', '17'] },
  { key: 'g_chat',    items: ['18', '19', '9'] },
  { key: 'g_verify',  items: ['10', '20', '21', '22', '23'] },
  { key: 'g_app',     items: ['24', '25', '26', '27'] },
];

export default function FAQScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const [openId, setOpenId] = useState(null);

  const toggle = (id) => setOpenId(prev => (prev === id ? null : id));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingVertical: 16, paddingBottom: 32 }}>
      {GROUPS.map(g => (
        <View key={g.key} style={{ marginBottom: 16 }}>
          <Text style={styles.groupLabel}>{t(`faq.${g.key}`)}</Text>
          <View style={styles.card}>
            {g.items.map((n, idx) => {
              const id = `q${n}`;
              const isOpen = openId === id;
              return (
                <View key={id} style={[idx !== g.items.length - 1 && styles.rowBorder]}>
                  <TouchableOpacity
                    style={styles.qRow}
                    onPress={() => toggle(id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.qText}>{t(`faq.q${n}`)}</Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={styles.aBox}>
                      <Text style={styles.aText}>{t(`faq.a${n}`)}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <View style={styles.cta}>
        <Text style={styles.ctaText}>{t('faq.ctaText')}</Text>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => navigation.navigate('InquiryForm')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>{t('faq.ctaBtn')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.inputBg },
  groupLabel: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary,
    paddingHorizontal: 20, marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, marginHorizontal: 16, overflow: 'hidden',
  },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  qRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16,
  },
  qText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, marginRight: 8 },
  aBox: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 },
  aText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  cta: { alignItems: 'center', marginTop: 16, paddingHorizontal: 16 },
  ctaText: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  ctaBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
  },
  ctaBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
