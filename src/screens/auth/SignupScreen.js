import { useState, useEffect } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Alert,
  Modal,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { ROLES } from '../../constants/roles';
import { checkNickname, sendEmailCode, checkEmailCode } from '../../lib/api';
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from '../../constants/legal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthLangToggle from '../../components/AuthLangToggle';

const CITIES = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton',
  'Ottawa', 'Winnipeg', 'Victoria', 'Halifax', 'Saskatoon',
  'London', 'Quebec',
];

export default function SignupScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const { register } = useAuth();
  const { t } = useLang();

  const ROLE_OPTIONS = [
    { role: ROLES.STUDENT,         label: t('auth.roleStudent'), emoji: '🎓', desc: t('auth.roleStudentDesc') },
    { role: ROLES.WORKING_HOLIDAY, label: t('auth.roleWH'),      emoji: '✈️', desc: t('auth.roleWHDesc') },
    { role: ROLES.GENERAL,         label: t('auth.roleGeneral'), emoji: '🍁', desc: t('auth.roleGeneralDesc') },
  ];

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [nickname, setNickname] = useState('');
  const [nickChecked, setNickChecked] = useState(false);
  const [nickChecking, setNickChecking] = useState(false);
  const [nickMsg, setNickMsg] = useState('');
  const [role, setRole] = useState(ROLES.GENERAL);
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [docModal, setDocModal] = useState(null); // 'terms' | 'privacy' | null
  const [cityModalOpen, setCityModalOpen] = useState(false);

  // 재발송 쿨다운 타이머
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setTimeout(() => setEmailCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailCooldown]);

  // 이메일 형식 검증
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validateEmail = (v) => {
    setEmail(v);
    // 이메일 변경하면 인증 초기화
    if (emailVerified || emailCodeSent) {
      setEmailVerified(false);
      setEmailCodeSent(false);
      setEmailCode('');
    }
    if (!v.trim()) { setEmailError(''); return; }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
    setEmailError(valid ? '' : t('auth.emailInvalid'));
  };

  // 인증코드 발송
  const handleSendCode = async () => {
    if (!isEmailValid) return;
    setEmailSending(true);
    try {
      const res = await sendEmailCode(email.trim());
      if (res.success) {
        setEmailCodeSent(true);
        setEmailCooldown(60);
        Alert.alert('', t('auth.codeSent'));
      } else {
        Alert.alert(t('common.error'), res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('common.serverError'));
    } finally {
      setEmailSending(false);
    }
  };

  // 인증코드 확인
  const handleCheckCode = async () => {
    if (emailCode.trim().length !== 6) {
      Alert.alert(t('common.error'), t('auth.verifyCodeHint'));
      return;
    }
    setEmailVerifying(true);
    try {
      const res = await checkEmailCode(email.trim(), emailCode.trim());
      if (res.success) {
        setEmailVerified(true);
      } else {
        Alert.alert(t('common.error'), res.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('common.serverError'));
    } finally {
      setEmailVerifying(false);
    }
  };

  // 비밀번호 강도 계산
  const getPasswordStrength = (pw) => {
    if (!pw) return null;
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: t('auth.pwWeak'), color: colors.danger, width: '33%' };
    if (score <= 3) return { label: t('auth.pwMedium'), color: colors.warning, width: '66%' };
    return { label: t('auth.pwStrong'), color: colors.success, width: '100%' };
  };
  const pwStrength = getPasswordStrength(password);
  const pwMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const allAgreed = agreeTerms && agreePrivacy && agreeAge;
  const toggleAll = () => {
    const next = !allAgreed;
    setAgreeTerms(next); setAgreePrivacy(next); setAgreeAge(next);
  };

  const onChangeNickname = (v) => {
    setNickname(v);
    setNickChecked(false);
    setNickMsg('');
  };

  const handleCheck = async () => {
    const v = nickname.trim();
    if (v.length < 2 || v.length > 20) {
      setNickMsg(t('auth.checkLen'));
      setNickChecked(false);
      return;
    }
    setNickChecking(true);
    try {
      const res = await checkNickname(v);
      if (res.success && res.data?.available) {
        setNickChecked(true);
        setNickMsg(t('auth.checkOk'));
      } else {
        setNickChecked(false);
        setNickMsg(t('auth.checkDup'));
      }
    } catch {
      setNickMsg(t('common.networkError'));
    } finally {
      setNickChecking(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password.trim() || !nickname.trim()) {
      setError(t('auth.signupFailed'));
      return;
    }
    if (!emailVerified) {
      Alert.alert(t('common.error'), t('auth.emailNotVerified'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('auth.passwordPlaceholder'));
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert(t('common.error'), t('auth.pwMismatch'));
      return;
    }
    if (!nickChecked) {
      Alert.alert(t('common.error'), t('auth.needCheck'));
      return;
    }
    if (!allAgreed) {
      Alert.alert(t('common.error'), t('auth.mustAgree'));
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password, nickname.trim(), role, city.trim());
    } catch (e) {
      setError(e.message || t('auth.signupFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
    <AuthLangToggle />
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('auth.signup')}</Text>

        <Text style={styles.label}>{t('auth.email')}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={validateEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            editable={!emailVerified}
          />
          {emailVerified ? (
            <View style={[styles.checkBtn, { backgroundColor: colors.success }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.white} />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.checkBtn, (!isEmailValid || emailSending || emailCooldown > 0) && { opacity: 0.5 }]}
              onPress={handleSendCode}
              disabled={!isEmailValid || emailSending || emailCooldown > 0}
            >
              {emailSending
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.checkBtnText}>
                    {emailCooldown > 0 ? `${emailCooldown}s` : (emailCodeSent ? t('auth.verifyResend') : t('auth.sendCode'))}
                  </Text>}
            </TouchableOpacity>
          )}
        </View>
        {!!emailError && <Text style={[styles.hint, { color: colors.danger }]}>{emailError}</Text>}

        {/* 인증코드 입력 (코드 발송 후, 인증 완료 전) */}
        {emailCodeSent && !emailVerified && (
          <View style={[styles.row, { marginTop: 8 }]}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('auth.verifyCodeHint')}
              placeholderTextColor={colors.textSecondary}
              value={emailCode}
              onChangeText={(v) => setEmailCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.checkBtn, emailCode.length !== 6 && { opacity: 0.5 }]}
              onPress={handleCheckCode}
              disabled={emailCode.length !== 6 || emailVerifying}
            >
              {emailVerifying
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.checkBtnText}>{t('auth.verifyConfirm')}</Text>}
            </TouchableOpacity>
          </View>
        )}
        {emailVerified && (
          <Text style={[styles.hint, { color: colors.success }]}>{t('auth.emailVerifiedMsg')}</Text>
        )}

        <Text style={[styles.label, { marginTop: 14 }]}>{t('auth.password')}</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={[styles.input, { flex: 1, marginTop: 0, backgroundColor: 'transparent' }]}
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={12} accessibilityLabel={t('a11y.togglePassword')} accessibilityRole="button">
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {pwStrength && (
          <View style={styles.strengthRow}>
            <View style={styles.strengthBarBg}>
              <View style={[styles.strengthBarFill, { width: pwStrength.width, backgroundColor: pwStrength.color }]} />
            </View>
            <Text style={[styles.strengthLabel, { color: pwStrength.color }]}>{pwStrength.label}</Text>
          </View>
        )}
        {password.length > 0 && (
          <View style={styles.pwReqs}>
            <Text style={[styles.pwReqItem, password.length >= 6 && styles.pwReqMet]}>
              {password.length >= 6 ? '✓' : '○'} {t('auth.pwReq6')}
            </Text>
            <Text style={[styles.pwReqItem, /[A-Z]/.test(password) && styles.pwReqMet]}>
              {/[A-Z]/.test(password) ? '✓' : '○'} {t('auth.pwReqUpper')}
            </Text>
            <Text style={[styles.pwReqItem, /[0-9]/.test(password) && styles.pwReqMet]}>
              {/[0-9]/.test(password) ? '✓' : '○'} {t('auth.pwReqNum')}
            </Text>
            <Text style={[styles.pwReqItem, /[^A-Za-z0-9]/.test(password) && styles.pwReqMet]}>
              {/[^A-Za-z0-9]/.test(password) ? '✓' : '○'} {t('auth.pwReqSpecial')}
            </Text>
          </View>
        )}

        <Text style={[styles.label, { marginTop: 14 }]}>{t('auth.passwordConfirm')}</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={[styles.input, { flex: 1, marginTop: 0, backgroundColor: 'transparent' }]}
            placeholder={t('auth.passwordConfirmPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry={!showPasswordConfirm}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPasswordConfirm(v => !v)} hitSlop={12} accessibilityLabel={t('a11y.togglePassword')} accessibilityRole="button">
            <Ionicons name={showPasswordConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {pwMismatch && <Text style={[styles.hint, { color: colors.danger }]}>{t('auth.pwMismatch')}</Text>}

        <Text style={[styles.label, { marginTop: 14 }]}>{t('auth.nickname')}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder={t('auth.nicknamePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={nickname}
            onChangeText={onChangeNickname}
            maxLength={20}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.checkBtn, nickChecked && styles.checkBtnDone]}
            onPress={handleCheck}
            disabled={nickChecking || nickChecked}
          >
            {nickChecking
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.checkBtnText}>
                  {nickChecked ? t('auth.checkDone') : t('auth.checkNickname')}
                </Text>}
          </TouchableOpacity>
        </View>
        {!!nickMsg && (
          <Text style={[styles.hint, { color: nickChecked ? colors.success : colors.danger }]}>
            {nickMsg}
          </Text>
        )}

        <Text style={[styles.label, { marginTop: 18 }]}>{t('auth.role')}</Text>
        <View style={styles.roleCol}>
          {ROLE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.role}
              style={[styles.roleBtn, role === opt.role && styles.roleBtnActive]}
              onPress={() => setRole(opt.role)}
              activeOpacity={0.85}
            >
              <Text style={styles.roleEmoji}>{opt.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleLabel, role === opt.role && { color: colors.primary }]}>
                  {opt.label}
                </Text>
                <Text style={styles.roleDesc}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 18 }]}>
          {t('auth.city')} <Text style={styles.optional}>{t('auth.cityOptional')}</Text>
        </Text>
        <TouchableOpacity
          style={styles.cityDropdown}
          onPress={() => setCityModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.cityDropdownText, !city && { color: colors.textSecondary }]}>
            {city ? `📍 ${t(`city.${city}`) || city}` : t('auth.cityPlaceholder')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* ── 약관 동의 ── */}
        <View style={styles.agreeBox}>
          <TouchableOpacity style={styles.agreeAllRow} onPress={toggleAll} activeOpacity={0.7}>
            <Ionicons
              name={allAgreed ? 'checkbox' : 'square-outline'}
              size={22}
              color={allAgreed ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.agreeAllText}>{t('auth.agreeAll')}</Text>
          </TouchableOpacity>
          <View style={styles.agreeDivider} />

          <View style={styles.agreeRow}>
            <TouchableOpacity
              style={styles.agreeLeft}
              onPress={() => setAgreeTerms(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={agreeTerms ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={agreeTerms ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.agreeText}>{t('auth.agreeTerms')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDocModal('terms')}>
              <Text style={styles.viewLink}>{t('auth.view')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.agreeRow}>
            <TouchableOpacity
              style={styles.agreeLeft}
              onPress={() => setAgreePrivacy(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={agreePrivacy ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={agreePrivacy ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.agreeText}>{t('auth.agreePrivacy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDocModal('privacy')}>
              <Text style={styles.viewLink}>{t('auth.view')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.agreeRow}>
            <TouchableOpacity
              style={styles.agreeLeft}
              onPress={() => setAgreeAge(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={agreeAge ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={agreeAge ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.agreeText}>{t('auth.agreeAge')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitBtnText}>{t('auth.signupBtn')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
            {t('auth.goLogin')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 도시 선택 모달 */}
      <Modal
        visible={cityModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCityModalOpen(false)}
      >
        <View style={styles.cityModalOverlay}>
          <View style={styles.cityModalContent}>
            <View style={styles.cityModalHeader}>
              <Text style={styles.cityModalTitle}>{t('home.regionFilter')}</Text>
              <TouchableOpacity onPress={() => setCityModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {/* 선택 안함 */}
            <TouchableOpacity
              style={[styles.cityItem, !city && styles.cityItemActive]}
              onPress={() => { setCity(''); setCityModalOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.cityItemText, !city && styles.cityItemTextActive]}>
                {t('auth.citySkip')}
              </Text>
            </TouchableOpacity>
            <FlatList
              data={CITIES}
              keyExtractor={(item) => item}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={[styles.cityItem, city === c && styles.cityItemActive]}
                  onPress={() => { setCity(c); setCityModalOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cityItemText, city === c && styles.cityItemTextActive]}>
                    📍 {t(`city.${c}`) || c}
                  </Text>
                  {city === c && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>

      {/* 약관/방침 본문 모달 */}
      <Modal
        visible={!!docModal}
        animationType="slide"
        onRequestClose={() => setDocModal(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {docModal === 'terms' ? t('mypage.terms') : t('mypage.privacy')}
            </Text>
            <TouchableOpacity onPress={() => setDocModal(null)} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
            <Text style={{ fontSize: 13, lineHeight: 22, color: colors.text }}>
              {docModal === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 10, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 12, padding: 14,
    fontSize: 14, fontWeight: '400', color: colors.text, marginTop: 6,
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  checkBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, alignItems: 'center', marginTop: 6,
  },
  checkBtnDone: { backgroundColor: colors.textSecondary },
  checkBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 12, marginTop: 4 },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.inputBg, borderRadius: 12, marginTop: 6,
  },
  eyeBtn: {
    paddingHorizontal: 12, paddingVertical: 14,
  },
  pwReqs: { marginTop: 6, gap: 2 },
  pwReqItem: { fontSize: 11, color: colors.textSecondary },
  pwReqMet: { color: colors.success },
  strengthRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6,
  },
  strengthBarBg: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.inputBg,
  },
  strengthBarFill: {
    height: 4, borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11, fontWeight: '600', minWidth: 28,
  },
  optional: { fontSize: 12, color: colors.textSecondary, fontWeight: '400' },
  roleCol: { gap: 8, marginTop: 8 },
  roleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.inputBg, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  roleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  roleEmoji: { fontSize: 24 },
  roleLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  roleDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  agreeBox: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginTop: 20,
  },
  agreeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  agreeAllText: { fontSize: 15, fontWeight: '700', color: colors.text },
  agreeDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  agreeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6,
  },
  agreeLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  agreeText: { fontSize: 14, color: colors.text },
  viewLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  errorText: {
    fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: 12,
  },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 20,
  },
  submitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text },

  // 도시 드롭다운
  cityDropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.inputBg, borderRadius: 12, padding: 14, marginTop: 6,
  },
  cityDropdownText: { fontSize: 15, color: colors.text },
  cityModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  cityModalContent: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34, maxHeight: '70%',
  },
  cityModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cityModalTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cityItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  cityItemActive: { backgroundColor: colors.primary + '10' },
  cityItemText: { fontSize: 15, color: colors.text },
  cityItemTextActive: { color: colors.primary, fontWeight: '700' },
});
