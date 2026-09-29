import { View, TouchableOpacity, StyleSheet } from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';

// The shared component behind every custom header
// - left: back button (or nothing)
// - centre: title (absolutely positioned, always dead centre)
// - right: N action buttons (each wrapped in a capsule)
//
// rightActions shape:
//   - icon button: { icon: 'search', onPress, color?, iconSize?, label? }
//   - text button: { text: 'Group', onPress, color?, label? }
// rightContent: for passing a React node directly (instead of rightActions)
// Without onBack, navigation.goBack() is called
export default function CustomHeader({
  navigation,
  title,
  onBack,
  showBack = true,
  rightActions,
  rightContent,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const handleBack = onBack || (() => navigation?.goBack());

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity
            style={styles.btn}
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.btn} />
        )}

        <View style={styles.titleWrap} pointerEvents="none">
          {title ? (
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          ) : null}
        </View>

        <View style={styles.rightActions}>
          {rightContent ? (
            rightContent
          ) : (rightActions && rightActions.length > 0) ? (
            rightActions.map((a, i) => (
              <TouchableOpacity
                key={i}
                style={a.text ? styles.btnText : styles.btn}
                onPress={a.onPress}
                disabled={a.disabled}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                {a.text ? (
                  <Text style={[styles.btnTextLabel, { color: a.color || colors.primary }]}>
                    {a.text}
                  </Text>
                ) : (
                  <Ionicons
                    name={a.icon}
                    size={a.iconSize || 20}
                    color={a.color || colors.text}
                  />
                )}
              </TouchableOpacity>
            ))
          ) : null /* An empty slot when there are no right actions — the title stays centred via absoluteFill */}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(118,118,128,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: {
    minWidth: 52, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(118,118,128,0.12)',
    paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnTextLabel: { fontSize: 14, fontWeight: '700' },
  titleWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 84,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  rightActions: { flexDirection: 'row', gap: 8 },
});
