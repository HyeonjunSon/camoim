import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';

// 모든 커스텀 헤더의 통일 컴포넌트
// - 좌측: 뒤로가기 (또는 비워두기)
// - 중앙: 제목 (절대 위치, 항상 정중앙)
// - 우측: 액션 버튼 N개 (각각 캡슐로 감쌈)
//
// rightActions 형식:
//   - 아이콘 버튼: { icon: 'search', onPress, color?, iconSize?, label? }
//   - 텍스트 버튼: { text: '그룹', onPress, color?, label? }
// rightContent: 직접 React 노드 넣고 싶을 때 (rightActions 대신)
// onBack 안 주면 navigation.goBack() 호출
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
          ) : (
            <View style={styles.btn} />
          )}
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
