import { useLayoutEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native'
import { Text } from '../../components/StyledText';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { useLang } from '../../context/LangContext';
import {
  TERMS_OF_SERVICE, TERMS_VERSION,
  PRIVACY_POLICY, PRIVACY_VERSION,
} from '../../constants/legal';

// Shared screen for the terms of service and privacy policy
// route.params.type: 'terms' | 'privacy'
export default function LegalDocScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const type = route.params?.type ?? 'terms';
  const isTerms = type === 'terms';

  const body = isTerms ? TERMS_OF_SERVICE : PRIVACY_POLICY;
  const version = isTerms ? TERMS_VERSION : PRIVACY_VERSION;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t(isTerms ? 'mypage.terms' : 'mypage.privacy'),
    });
  }, [navigation, isTerms, t]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.versionTag}>v{version}</Text>
      <Text style={styles.body}>{body}</Text>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  versionTag: {
    alignSelf: 'flex-start', fontSize: 11, fontWeight: '600',
    color: colors.textSecondary, backgroundColor: colors.inputBg,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 14,
  },
  body: { fontSize: 13, lineHeight: 22, color: colors.text },
});
