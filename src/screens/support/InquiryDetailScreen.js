import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Text } from '../../components/StyledText';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useLang } from '../../context/LangContext';
import { getMyInquiry } from '../../lib/api';

export default function InquiryDetailScreen({ route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const { id } = route.params;
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getMyInquiry(id);
        if (res.success) setItem(res.data);
      } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!item) return null;

  const answered = item.status === 'answered';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.row}>
        <View style={[styles.badge, answered ? styles.badgeAnswered : styles.badgeOpen]}>
          <Text style={[styles.badgeText, answered ? { color: '#10B981' } : { color: colors.primary }]}>
            {t(answered ? 'inquiry.stAnswered' : 'inquiry.stOpen')}
          </Text>
        </View>
        <Text style={styles.cat}>{t(`inquiry.c_${item.category}`)}</Text>
      </View>

      <Text selectable style={styles.title}>{item.title}</Text>
      <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>

      <Text style={styles.sectionLabel}>{t('inquiry.yourQuestion')}</Text>
      <View style={styles.box}>
        <Text selectable style={styles.bodyText}>{item.content}</Text>
      </View>

      <Text style={styles.sectionLabel}>{t('inquiry.adminAnswer')}</Text>
      <View style={[styles.box, !answered && styles.boxEmpty]}>
        {answered ? (
          <>
            <Text selectable style={styles.bodyText}>{item.answer}</Text>
            {item.answeredAt && (
              <Text style={[styles.date, { marginTop: 8 }]}>
                {new Date(item.answeredAt).toLocaleString()}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.noAnswer}>{t('inquiry.noAnswerYet')}</Text>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeAnswered: { backgroundColor: '#10B981' + '15' },
  badgeOpen: { backgroundColor: colors.primary + '15' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cat: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  date: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 24, marginBottom: 8,
  },
  box: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  boxEmpty: { borderStyle: 'dashed' },
  bodyText: { fontSize: 14, color: colors.text, lineHeight: 22 },
  noAnswer: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 },
});
