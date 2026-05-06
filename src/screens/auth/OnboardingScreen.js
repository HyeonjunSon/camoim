// 소셜 가입(애플/구글) 후 추가 정보 수집 화면
// 이메일 가입은 SignupScreen으로 가고, 소셜은 여기서 닉네임/유형/도시/약관만 받음
import { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from '../../components/StyledText';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import { checkNickname } from '../../lib/api';
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from '../../constants/legal';
import AuthLangToggle from '../../components/AuthLangToggle';

const CITIES = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton',
  'Ottawa', 'Winnipeg', 'Victoria', 'Halifax', 'Saskatoon',
  'London', 'Quebec',
];

export default function OnboardingScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const { completeOnboarding } = useAuth();
  const styles = createStyles(colors);

  const preRegToken = route?.params?.preRegToken || '';
  const provider = route?.params?.provider || 'apple';
  const email = route?.params?.email || '';

  const [nickname, setNickname] = useState('');
  const [nickChecked, setNickChecked] = useState(false);
  const [nickChecking, setNickChecking] = useState(false);
  const [nickMsg, setNickMsg] = useState('');
  const [role, setRole] = useState(ROLES.GENERAL);
  const [city, setCity] = useState('');
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [docModal, setDocModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const ROLE_OPTIONS = [
    { role: ROLES.STUDENT,         label: t('auth.roleStudent'), emoji: '🎓', desc: t('auth.roleStudentDesc') },
    { role: ROLES.WORKING_HOLIDAY, label: t('auth.roleWH'),      emoji: '✈️', desc: t('auth.roleWHDesc') },
    { role: ROLES.GENERAL,         label: t('auth.roleGeneral'), emoji: '🍁', desc: t('auth.roleGeneralDesc') },
  ];

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
      await completeOnboarding(preRegToken, {
        nickname: nickname.trim(),
        role,
        city: city.trim(),
      });
    } catch (e) {
      setError(e.message || t('auth.onboardingFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AuthLangToggle />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('auth.onboardingTitle')}</Text>
        <Text style={styles.desc}>{t('auth.onboardingDesc')}</Text>

        {!!email && (
          <View style={styles.emailBadge}>
            <Ionicons
              name={provider === 'apple' ? 'logo-apple' : 'logo-google'}
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.emailBadgeText}>{email}</Text>
          </View>
        )}

        {/* 닉네임 */}
        <Text style={styles.label}>{t('auth.nickname')}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder={t('auth.nicknamePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={nickname}
            onChangeText={onChangeNickname}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
          <TouchableOpacity
            style={[styles.checkBtn, (nickname.trim().length < 2 || nickChecking) && styles.checkBtnDisabled]}
            onPress={handleCheck}
            disabled={nickname.trim().length < 2 || nickChecking}
            activeOpacity={0.85}
          >
            {nickChecking
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={styles.checkBtnText}>{t('auth.check')}</Text>}
          </TouchableOpacity>
        </View>
        {nickMsg ? (
          <Text style={[styles.statusText, { color: nickChecked ? colors.success : colors.danger }]}>
            {nickMsg}
          </Text>
        ) : null}

        {/* 유형 */}
        <Text style={[styles.label, { marginTop: 16 }]}>{t('auth.role')}</Text>
        <View style={styles.roleRow}>
          {ROLE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.role}
              style={[styles.roleCard, role === opt.role && styles.roleCardActive]}
              onPress={() => setRole(opt.role)}
              activeOpacity={0.85}
            >
              <Text style={styles.roleEmoji}>{opt.emoji}</Text>
              <Text style={[styles.roleLabel, role === opt.role && styles.roleLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.roleDesc} numberOfLines={2}>{opt.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 도시 */}
        <Text style={[styles.label, { marginTop: 16 }]}>
          {t('auth.city')} <Text style={styles.optionalText}>{t('auth.cityOptional')}</Text>
        </Text>
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setCityModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownText, !city && styles.dropdownPlaceholder]}>
            {city ? (t(`city.${city}`) || city) : t('auth.cityPlaceholder')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* 약관 */}
        <View style={styles.agreeBox}>
          <TouchableOpacity style={styles.agreeAllRow} onPress={toggleAll} activeOpacity={0.7}>
            <Ionicons
              name={allAgreed ? 'checkbox' : 'square-outline'}
              size={22}
              color={allAgreed ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.agreeAllText}>{t('auth.agreeAll')}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreeTerms(v => !v)} activeOpacity={0.7}>
            <Ionicons
              name={agreeTerms ? 'checkbox' : 'square-outline'}
              size={20}
              color={agreeTerms ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.agreeText}>{t('auth.agreeTerms')}</Text>
            <TouchableOpacity onPress={() => setDocModal('terms')}>
              <Text style={styles.agreeView}>{t('auth.view')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
          <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreePrivacy(v => !v)} activeOpacity={0.7}>
            <Ionicons
              name={agreePrivacy ? 'checkbox' : 'square-outline'}
              size={20}
              color={agreePrivacy ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.agreeText}>{t('auth.agreePrivacy')}</Text>
            <TouchableOpacity onPress={() => setDocModal('privacy')}>
              <Text style={styles.agreeView}>{t('auth.view')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
          <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreeAge(v => !v)} activeOpacity={0.7}>
            <Ionicons
              name={agreeAge ? 'checkbox' : 'square-outline'}
              size={20}
              color={agreeAge ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.agreeText}>{t('auth.agreeAge')}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, (!nickChecked || !allAgreed || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!nickChecked || !allAgreed || submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitBtnText}>{t('auth.onboardingComplete')}</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* 도시 선택 모달 */}
      <Modal visible={cityModalOpen} animationType="slide" transparent onRequestClose={() => setCityModalOpen(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{t('auth.cityPlaceholder')}</Text>
              <TouchableOpacity onPress={() => setCityModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.pickerItem, !city && styles.pickerItemActive]}
              onPress={() => { setCity(''); setCityModalOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerItemText, !city && styles.pickerItemTextActive]}>{t('auth.citySkip')}</Text>
            </TouchableOpacity>
            <FlatList
              data={CITIES}
              keyExtractor={item => item}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, city === c && styles.pickerItemActive]}
                  onPress={() => { setCity(c); setCityModalOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerItemText, city === c && styles.pickerItemTextActive]}>
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

      {/* 약관/개인정보 본문 모달 */}
      <Modal visible={!!docModal} animationType="slide" onRequestClose={() => setDocModal(null)}>
        <View style={styles.docContainer}>
          <View style={styles.docHeader}>
            <Text style={styles.docTitle}>
              {docModal === 'terms' ? t('auth.agreeTerms') : t('auth.agreePrivacy')}
            </Text>
            <TouchableOpacity onPress={() => setDocModal(null)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.docBody}>
            <Text style={styles.docText}>
              {docModal === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 8 },
  desc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  emailBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.inputBg,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  emailBadgeText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: 6 },
  optionalText: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 12, padding: 14,
    fontSize: 15, color: colors.text,
  },
  checkBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    minWidth: 80, alignItems: 'center', justifyContent: 'center',
  },
  checkBtnDisabled: { opacity: 0.4 },
  checkBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  statusText: { fontSize: 12, fontWeight: '600', marginTop: 6 },

  roleRow: { flexDirection: 'row', gap: 8 },
  roleCard: {
    flex: 1,
    backgroundColor: colors.inputBg, borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  roleEmoji: { fontSize: 24, marginBottom: 4 },
  roleLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 },
  roleLabelActive: { color: colors.primary },
  roleDesc: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', lineHeight: 14 },

  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.inputBg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  dropdownText: { fontSize: 15, color: colors.text, flex: 1 },
  dropdownPlaceholder: { color: colors.textSecondary },

  agreeBox: {
    backgroundColor: colors.inputBg, borderRadius: 12,
    padding: 14, marginTop: 18,
  },
  agreeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  agreeAllText: { fontSize: 14, fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  agreeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4,
  },
  agreeText: { fontSize: 13, color: colors.text, flex: 1 },
  agreeView: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  errorText: { fontSize: 13, color: colors.danger, marginTop: 12, textAlign: 'center' },

  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34, maxHeight: '75%',
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  pickerItemActive: { backgroundColor: colors.primary + '10' },
  pickerItemText: { fontSize: 15, color: colors.text, flex: 1 },
  pickerItemTextActive: { color: colors.primary, fontWeight: '700' },

  docContainer: { flex: 1, backgroundColor: colors.background },
  docHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  docTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  docBody: { padding: 20 },
  docText: { fontSize: 13, color: colors.text, lineHeight: 21 },
});
