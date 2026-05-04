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
import { resetPassword } from '../../lib/api';

export default function ResetPasswordScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const initialEmail = route?.params?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const codeValid = /^\d{6}$/.test(code.trim());
  const pwValid = password.length >= 6;
  const pwMatches = password === passwordConfirm && password.length > 0;
  const allValid = emailValid && codeValid && pwValid && pwMatches;

  const handleSubmit = async () => {
    if (!allValid) {
      if (!pwMatches) setError(t('auth.pwMismatch'));
      else if (!pwValid) setError(t('auth.pwTooShort'));
      else setError(t('auth.fillAllFields'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      Alert.alert(
        '',
        t('auth.resetSuccess'),
        [{
          text: t('common.done'),
          onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }),
        }]
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
          <Text style={styles.title}>{t('auth.resetPassword')}</Text>
          <Text style={styles.desc}>{t('auth.resetPasswordDesc')}</Text>
        </View>

        <Text style={styles.label}>{t('auth.email')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t('auth.verifyCode')}</Text>
        <TextInput
          style={styles.input}
          placeholder="000000"
          placeholderTextColor={colors.textSecondary}
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
        />

        <Text style={styles.label}>{t('auth.newPassword')}</Text>
        <View style={styles.pwWrap}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: 'transparent' }]}
            placeholder={t('auth.newPasswordPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw((v) => !v)} hitSlop={12} accessibilityLabel={t('a11y.togglePassword')} accessibilityRole="button">
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{t('auth.passwordConfirm')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('auth.passwordConfirmPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry={!showPw}
          autoCapitalize="none"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, (!allValid || loading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!allValid || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('auth.confirmReset')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 60 },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center',
    marginBottom: 12, marginLeft: -8,
  },
  headerArea: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 8 },
  desc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 12, padding: 14,
    fontSize: 15, color: colors.text, marginBottom: 0,
  },
  pwWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.inputBg, borderRadius: 12,
  },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 14 },
  errorText: { fontSize: 13, color: colors.danger, marginTop: 12 },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
