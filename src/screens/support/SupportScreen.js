import { Text } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useLang } from '../../context/LangContext';

export default function SupportScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();

  const openMail = async (addr) => {
    const url = `mailto:${addr}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) return Alert.alert(t('support.cantOpenMail'));
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('support.cantOpenMail'));
    }
  };

  const Item = ({ icon, label, desc, onPress, last }) => (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {desc && <Text style={styles.desc}>{desc}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingVertical: 16 }}>
      <View style={styles.card}>
        <Item
          icon="help-circle-outline"
          label={t('support.menuFaq')}
          desc={t('support.menuFaqDesc')}
          onPress={() => navigation.navigate('FAQ')}
        />
        <Item
          icon="chatbubble-ellipses-outline"
          label={t('support.menuInquiry')}
          desc={t('support.menuInquiryDesc')}
          onPress={() => navigation.navigate('InquiryForm')}
        />
        <Item
          icon="reader-outline"
          label={t('support.menuMy')}
          desc={t('support.menuMyDesc')}
          onPress={() => navigation.navigate('MyInquiries')}
          last
        />
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <Item
          icon="megaphone-outline"
          label={t('support.menuAd')}
          desc={t('support.menuAdDesc')}
          onPress={() => navigation.navigate('InquiryForm', { lockedCategory: 'ad' })}
        />
        <Item
          icon="mail-outline"
          label={t('support.menuMail')}
          desc={t('support.menuMailDesc')}
          onPress={() => openMail('camoimapp@gmail.com')}
          last
        />
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.inputBg },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, marginHorizontal: 16, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primary + '12', alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  desc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
