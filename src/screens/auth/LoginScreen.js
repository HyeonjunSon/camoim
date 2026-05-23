import { useState, useEffect } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';

// Google Sign-In은 Expo Go에 네이티브 모듈이 없어 require가 실패함.
// 정식 빌드(EAS)에서만 동작하도록 안전하게 lazy load.
let GoogleSignin = null;
let statusCodes = null;
try {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
  statusCodes = mod.statusCodes;
} catch (e) {
  if (__DEV__) console.warn('[GoogleSignin] native module unavailable (Expo Go). Google 로그인 버튼이 숨겨집니다.');
}
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors';
import AuthLangToggle from '../../components/AuthLangToggle';

const GOOGLE_WEB_CLIENT_ID =
  Constants.expoConfig?.extra?.googleWebClientId ||
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '';
const GOOGLE_IOS_CLIENT_ID =
  Constants.expoConfig?.extra?.googleIosClientId ||
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  '';

// Google brand "G" logo PNG (공식 호스팅, 캐시 가능)
const GOOGLE_G_LOGO = 'https://developers.google.com/identity/images/g-logo.png';

let googleConfigured = false;
function ensureGoogleConfigured() {
  if (googleConfigured) return;
  if (!GoogleSignin) return; // Expo Go 등 네이티브 미탑재
  if (!GOOGLE_IOS_CLIENT_ID) return;
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      offlineAccess: false,
    });
    googleConfigured = true;
  } catch (e) {
    console.warn('[LoginScreen] GoogleSignin configure failed:', e?.message);
  }
}

const googleAvailable = !!GoogleSignin;

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { login, loginWithApple, loginWithGoogle } = useAuth();
  const { t } = useLang();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [socialBusy, setSocialBusy] = useState(null);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    ensureGoogleConfigured();
  }, []);

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

  const handleApple = async () => {
    setError('');
    setSocialBusy('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identityToken from Apple');
      const result = await loginWithApple(credential.identityToken);
      if (result?.needsOnboarding) {
        navigation.navigate('Onboarding', {
          preRegToken: result.preRegToken,
          provider: 'apple',
          email: result.email || '',
        });
      }
    } catch (e) {
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        // 사용자 취소
      } else {
        const base = e.message || t('auth.appleLoginFailed');
        setError(e.debug ? `${base}\n[debug] ${e.debug}` : base);
      }
    } finally {
      setSocialBusy(null);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSocialBusy('google');
    try {
      if (!GoogleSignin) {
        Alert.alert('', 'Google 로그인은 정식 빌드(TestFlight/App Store)에서만 작동해요. Expo Go에서는 사용 불가.');
        return;
      }
      ensureGoogleConfigured();
      if (!GOOGLE_IOS_CLIENT_ID) {
        Alert.alert('', 'Google Sign-In is not configured yet. Please try Apple or email login.');
        return;
      }
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken || userInfo?.idToken;
      if (!idToken) throw new Error('No idToken from Google');
      const result = await loginWithGoogle(idToken);
      if (result?.needsOnboarding) {
        navigation.navigate('Onboarding', {
          preRegToken: result.preRegToken,
          provider: 'google',
          email: result.email || '',
        });
      }
    } catch (e) {
      if (e?.code === statusCodes?.SIGN_IN_CANCELLED || e?.code === statusCodes?.IN_PROGRESS) {
        // skip
      } else {
        const base = e.message || t('auth.googleLoginFailed');
        setError(e.debug ? `${base}\n[debug] ${e.debug}` : base);
      }
    } finally {
      setSocialBusy(null);
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoArea}>
          <Text style={styles.logoText}>CaMoim</Text>
          <Text style={styles.tagline}>{t('auth.welcome')}</Text>
        </View>

        {/* 이메일 로그인 폼 (위) */}
        <View style={styles.formArea}>
          <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
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
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t('auth.password')}</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('auth.password')}
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(v => !v)}
              hitSlop={12}
              accessibilityLabel={t('a11y.togglePassword')}
              accessibilityRole="button"
            >
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
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.loginButtonText}>{t('auth.loginBtn')}</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotLinkArea}
            onPress={() => navigation.navigate('ForgotPassword')}
            hitSlop={8}
          >
            <Text style={styles.forgotLink}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>
        </View>

        {/* 또는 구분선 */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.orDivider')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* 소셜 로그인 (아래) */}
        <View style={styles.socialArea}>
          {appleAvailable && (
            <TouchableOpacity
              style={styles.appleBtn}
              onPress={handleApple}
              disabled={!!socialBusy}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {socialBusy === 'apple' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.appleBtnText}>{t('auth.continueWithApple')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {googleAvailable && (
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogle}
              disabled={!!socialBusy}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {socialBusy === 'google' ? (
                <ActivityIndicator color="#1F1F1F" />
              ) : (
                <>
                  <Image
                    source={GOOGLE_G_LOGO}
                    style={styles.googleLogo}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                  <Text style={styles.googleBtnText}>{t('auth.continueWithGoogle')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
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
    flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40, paddingTop: 80,
  },
  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoText: { fontSize: 36, fontWeight: '800', color: colors.primary },
  tagline: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },

  // 폼
  formArea: {},
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.inputBg, borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 6 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15, color: colors.text,
    backgroundColor: 'transparent',
  },
  eyeBtn: { paddingHorizontal: 6, paddingVertical: 14 },
  errorText: {
    fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: 10,
  },
  loginButton: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 16,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  forgotLinkArea: { marginTop: 12, alignItems: 'center' },
  forgotLink: { color: colors.textSecondary, fontSize: 13 },

  // 구분선
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.textSecondary, marginHorizontal: 12 },

  // 소셜
  socialArea: { gap: 10 },
  appleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000000', borderRadius: 12,
    paddingVertical: 14, height: 50,
  },
  appleBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingVertical: 14, height: 50,
    borderWidth: 1, borderColor: '#DADCE0',
  },
  googleLogo: { width: 18, height: 18, marginRight: 10 },
  googleBtnText: { color: '#1F1F1F', fontSize: 15, fontWeight: '600' },

  // 회원가입 링크
  signupLinkArea: { marginTop: 22, alignItems: 'center' },
  signupLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
