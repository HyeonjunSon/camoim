import { View, TouchableOpacity, StyleSheet } from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';

// Consistent empty-state UI — icon/emoji + title + description + an optional CTA
export default function EmptyState({
  icon,             // Ionicons name (optional)
  emoji,            // Emoji, as an alternative to icon (optional)
  title,            // Title (required)
  description,      // Supporting description (optional)
  ctaLabel,         // CTA button label (optional)
  onCtaPress,       // CTA onPress (paired with ctaLabel)
  compact = false,  // Compact variant (for FlatList ListEmptyComponent and the like)
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors, compact);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        {emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : icon ? (
          <Ionicons name={icon} size={compact ? 36 : 48} color={colors.textSecondary} />
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <TouchableOpacity style={styles.ctaBtn} onPress={onCtaPress} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = (colors, compact) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: compact ? 32 : 60,
  },
  iconWrap: {
    width: compact ? 56 : 80,
    height: compact ? 56 : 80,
    borderRadius: compact ? 28 : 40,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: compact ? 12 : 16,
  },
  emoji: {
    fontSize: compact ? 28 : 36,
  },
  title: {
    fontSize: compact ? 14 : 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  desc: {
    fontSize: compact ? 12 : 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 4,
  },
  ctaBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  ctaText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
