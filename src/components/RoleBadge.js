import { View, StyleSheet } from 'react-native'
import { Text } from './StyledText';
import { ROLE_COLORS, getRoleLabel } from '../constants/roles';
import { useLang } from '../context/LangContext';

// Role badge component
export default function RoleBadge({ role, size = 'small' }) {
  const { t } = useLang();
  if (!role || role === 'general') return null; // The general role shows no badge

  const label = getRoleLabel(role, t);
  const colors = ROLE_COLORS[role] || ROLE_COLORS.general;
  const isSmall = size === 'small';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: colors.bg },
      isSmall ? styles.small : styles.large,
    ]}>
      <Text style={[
        styles.text,
        { color: colors.text },
        isSmall ? styles.smallText : styles.largeText,
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  large: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontWeight: '600',
  },
  smallText: {
    fontSize: 11,
  },
  largeText: {
    fontSize: 13,
  },
});
