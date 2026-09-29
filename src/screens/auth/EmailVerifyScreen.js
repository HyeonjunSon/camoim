import { useState, useRef, useEffect } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { verifyEmail, resendEmailCode } from '../../lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthLangToggle from '../../components/AuthLangToggle';

export default function EmailVerifyScreen() {
  const { colors } = useTheme();
  const { t } = useLang();
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef(null);

  // Resend cooldown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      Alert.alert(t('common.error'), t('auth.verifyCodeHint'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await verifyEmail(code.trim());
      if (res.success) {
        await refreshUser();
      } else {
        Alert.alert(t('common.error'), res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('common.serverError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      const res = await resendEmailCode();
      if (res.success) {
        setCountdown(60);
        Alert.alert('', t('auth.verifyResent'));
      } else {
        Alert.alert(t('common.error'), res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('common.serverError'));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
      <AuthLangToggle />
      <View style={styles.iconWrap}>
        <Ionicons name="mail-outline" size={56} color={colors.primary} />
      </View>

      <Text style={styles.title}>{t('auth.verifyEmailTitle')}</Text>
      <Text style={styles.desc}>
        {t('auth.verifyEmailDesc').replace('{{email}}', user?.email || '')}
      </Text>

      <TextInput
        ref={inputRef}
        style={styles.codeInput}
        placeholder="000000"
        placeholderTextColor={colors.textSecondary}
        value={code}
        onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        textAlign="center"
        autoFocus
      />

      <TouchableOpacity
        style={[styles.verifyBtn, submitting && { opacity: 0.7 }]}
        onPress={handleVerify}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.verifyBtnText}>{t('auth.verifyConfirm')}</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resendBtn}
        onPress={handleResend}
        disabled={resending || countdown > 0}
        activeOpacity={0.7}
      >
        <Text style={[styles.resendText, (countdown > 0) && { color: colors.textSecondary }]}>
          {countdown > 0
            ? `${t('auth.verifyResendWait')} (${countdown}s)`
            : t('auth.verifyResend')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    paddingHorizontal: 30, alignItems: 'center',
  },
  iconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8,
  },
  desc: {
    fontSize: 14, color: colors.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: 32,
  },
  codeInput: {
    width: '100%', backgroundColor: colors.inputBg, borderRadius: 14,
    padding: 16, fontSize: 28, fontWeight: '800', color: colors.text,
    letterSpacing: 12, marginBottom: 20,
  },
  verifyBtn: {
    width: '100%', backgroundColor: colors.primary, borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  verifyBtnText: {
    color: colors.white, fontSize: 16, fontWeight: '700',
  },
  resendBtn: {
    marginTop: 20, padding: 10,
  },
  resendText: {
    fontSize: 14, color: colors.primary, fontWeight: '600',
  },
});
