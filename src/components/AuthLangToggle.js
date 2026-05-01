import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './StyledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';

export default function AuthLangToggle({ topOffset = 0 }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { lang, setLang } = useLang();
  const styles = createStyles(colors);

  return (
    <View
      style={[
        styles.wrap,
        { top: insets.top + 8 + topOffset, right: 16 },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.switch}>
        <TouchableOpacity
          style={[styles.opt, lang === 'ko' && styles.optActive]}
          onPress={() => setLang('ko')}
          activeOpacity={0.8}
          hitSlop={6}
        >
          <Text style={[styles.optText, lang === 'ko' && styles.optTextActive]}>한국어</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.opt, lang === 'en' && styles.optActive]}
          onPress={() => setLang('en')}
          activeOpacity={0.8}
          hitSlop={6}
        >
          <Text style={[styles.optText, lang === 'en' && styles.optTextActive]}>EN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 50,
  },
  switch: {
    flexDirection: 'row',
    backgroundColor: colors.inputBg,
    borderRadius: 999,
    padding: 3,
  },
  opt: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  optActive: {
    backgroundColor: colors.primary,
  },
  optText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  optTextActive: {
    color: colors.white,
  },
});
