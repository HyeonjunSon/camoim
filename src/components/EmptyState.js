import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';

// 일관된 빈 상태 UI — 아이콘/이모지 + 제목 + 설명 + (선택) CTA 버튼
export default function EmptyState({
  icon,             // Ionicons name (선택)
  emoji,            // 이모지 (icon 대신, 선택)
  title,            // 제목 (필수)
  description,      // 부연 설명 (선택)
  ctaLabel,         // CTA 버튼 라벨 (선택)
  onCtaPress,       // CTA onPress (ctaLabel과 함께)
  compact = false,  // 작은 버전 (FlatList ListEmptyComponent 등)
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
