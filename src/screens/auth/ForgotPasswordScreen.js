import { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from '../../components/StyledText';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import AuthLangToggle from '../../components/AuthLangToggle';
import { sendPasswordResetCode } from '../../lib/api';

export default function ForgotPasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async () => {
    if (!isEmailValid) {
      setError(t('auth.emailInvalid'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetCode(email.trim());
      Alert.alert(
        '',
        t('auth.resetCodeSent'),
        [{ text: t('common.done'), onPress: () => navigation.navigate('ResetPassword', { email: email.trim() }) }]
      );
    } catch (e) {
      setError(e.message || t('common.serverError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AuthLangToggle />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel={t('a11y.back')} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerArea}>
          <Text style={styles.title}>{t('auth.forgotPassword')}</Text>
          <Text style={styles.desc}>{t('auth.forgotPasswordDesc')}</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, (!isEmailValid || loading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!isEmailValid || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('auth.sendResetCode')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.altLinkArea}
          onPress={() => navigation.navigate('ResetPassword', { email: email.trim() })}
        >
          <Text style={styles.altLink}>{t('auth.alreadyHaveCode')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center',
    marginBottom: 12, marginLeft: -8,
  },
  headerArea: { marginBottom: 28 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 8 },
  desc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 12, padding: 14,
    fontSize: 15, color: colors.text, marginBottom: 8,
  },
  errorText: { fontSize: 13, color: colors.danger, marginTop: 4, marginBottom: 4 },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 16,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  altLinkArea: { marginTop: 20, alignItems: 'center' },
  altLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
