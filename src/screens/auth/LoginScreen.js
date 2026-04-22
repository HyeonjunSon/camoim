import { useState } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'

// 로그인 화면
export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { login } = useAuth();
  const { t } = useLang();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t('auth.email') + ' / ' + t('auth.password'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e.message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoArea}>
          <Text style={styles.logoText}>CaMoim</Text>
          <Text style={styles.tagline}>{t('auth.welcome')}</Text>
        </View>

        <View style={styles.formArea}>
          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.input, { flex: 1, marginTop: 0, backgroundColor: 'transparent' }]}
              placeholder={t('auth.password')}
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>{t('auth.loginBtn')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.signupLinkArea}>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.signupLink}>{t('auth.goSignup')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40,
  },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 36, fontWeight: '800', color: colors.primary },
  tagline: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },
  formArea: { gap: 12 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 12, padding: 14,
    fontSize: 15, color: colors.text,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.inputBg, borderRadius: 12,
  },
  eyeBtn: {
    paddingHorizontal: 12, paddingVertical: 14,
  },
  errorText: {
    fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: 4,
  },
  loginButton: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  signupLinkArea: { marginTop: 20, alignItems: 'center' },
  signupLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
