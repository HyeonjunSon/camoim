import { useState } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { deleteMyAccount } from '../../lib/api';

const TOTAL_STEPS = 4;

export default function DeleteAccountScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useLang();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  // Social-only signups (Apple/Google) have no password, so they confirm with their nickname instead
  const isSocialOnly = user?.hasPassword === false;

  const reasons = [
    t('mypage.deleteReason1'),
    t('mypage.deleteReason2'),
    t('mypage.deleteReason3'),
    t('mypage.deleteReason4'),
    t('mypage.deleteReason5'),
  ];

  const deletedData = [
    t('mypage.deleteData1'),
    t('mypage.deleteData2'),
    t('mypage.deleteData3'),
    t('mypage.deleteData4'),
    t('mypage.deleteData5'),
  ];

  const canGoNext = () => {
    if (step === 2) return reason !== '';
    if (step === 3) {
      return isSocialOnly
        ? confirmText.trim() === (user?.nickname || '')
        : password.length >= 1;
    }
    return true;
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
    else navigation.goBack();
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const finalReason = reason === t('mypage.deleteReason5') ? customReason : reason;
      const res = await deleteMyAccount(
        isSocialOnly
          ? { confirmText, reason: finalReason }
          : { password, reason: finalReason }
      );
      if (res?.success) {
        await logout().catch(() => {});
      } else {
        Alert.alert(t('common.error'), res?.message || t('common.serverError'));
      }
    } catch (e) {
      const msg = e?.message || t('common.serverError');
      if (msg.includes('비밀번호') || msg.includes('password')) {
        Alert.alert(t('common.error'), t('mypage.deleteWrongPassword'));
        setStep(3);
        setPassword('');
      } else if (msg.includes('닉네임') || msg.includes('nickname')) {
        Alert.alert(t('common.error'), t('mypage.deleteWrongNickname') || '닉네임이 일치하지 않습니다.');
        setStep(3);
        setConfirmText('');
      } else {
        Alert.alert(t('common.error'), msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 1: what deletion means
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Ionicons name="warning-outline" size={48} color={colors.danger} style={styles.stepIcon} />
      <Text style={styles.stepTitle}>{t('mypage.deleteStep1Title')}</Text>
      <Text style={styles.stepDesc}>{t('mypage.deleteStep1Desc')}</Text>
      <View style={styles.dataList}>
        {deletedData.map((item, i) => (
          <View key={i} style={styles.dataItem}>
            <Ionicons name="close-circle" size={18} color={colors.danger} />
            <Text style={styles.dataText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // Step 2: reason for leaving
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('mypage.deleteStep2Title')}</Text>
      <Text style={styles.stepDesc}>{t('mypage.deleteStep2Desc')}</Text>
      <View style={styles.reasonList}>
        {reasons.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.reasonItem, reason === item && styles.reasonItemActive]}
            onPress={() => setReason(item)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={reason === item ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={reason === item ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.reasonText, reason === item && styles.reasonTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {reason === t('mypage.deleteReason5') && (
        <TextInput
          style={styles.input}
          placeholder={t('mypage.deleteReasonPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={customReason}
          onChangeText={setCustomReason}
          multiline
          maxLength={200}
        />
      )}
    </View>
  );

  // Step 3: identity check — password for email signups, retyped nickname for social-only ones
  const renderStep3 = () => {
    if (isSocialOnly) {
      return (
        <View style={styles.stepContent}>
          <Ionicons name="person-outline" size={48} color={colors.primary} style={styles.stepIcon} />
          <Text style={styles.stepTitle}>{t('mypage.deleteStep3SocialTitle') || '본인 확인'}</Text>
          <Text style={styles.stepDesc}>
            {(t('mypage.deleteStep3SocialDesc') || 'Apple/Google 가입 회원은 비밀번호가 없어요.\n계속하려면 본인 닉네임을 정확히 입력해주세요.')}
          </Text>
          <View style={styles.nicknameBox}>
            <Text style={styles.nicknameHint}>
              {t('mypage.deleteNicknameHint') || '정확히 다음 닉네임을 입력하세요'}
            </Text>
            <Text style={styles.nicknameTarget}>{user?.nickname}</Text>
          </View>
          <TextInput
            style={styles.passwordInput}
            placeholder={t('mypage.deleteNicknamePlaceholder') || '닉네임을 입력하세요'}
            placeholderTextColor={colors.textSecondary}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>
      );
    }
    return (
      <View style={styles.stepContent}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.primary} style={styles.stepIcon} />
        <Text style={styles.stepTitle}>{t('mypage.deleteStep3Title')}</Text>
        <Text style={styles.stepDesc}>{t('mypage.deleteStep3Desc')}</Text>
        <TextInput
          style={styles.passwordInput}
          placeholder={t('mypage.deletePasswordPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus
        />
      </View>
    );
  };

  // Step 4: final confirmation
  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.danger} style={styles.stepIcon} />
      <Text style={styles.stepTitle}>{t('mypage.deleteStep4Title')}</Text>
      <Text style={styles.stepDesc}>{t('mypage.deleteStep4Desc')}</Text>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressDot, i < step && styles.progressDotActive]}
          />
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.prevBtn} onPress={handlePrev} activeOpacity={0.7}>
          <Text style={styles.prevBtnText}>{t('mypage.deletePrev')}</Text>
        </TouchableOpacity>

        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[styles.nextBtn, !canGoNext() && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canGoNext()}
            activeOpacity={0.7}
          >
            <Text style={styles.nextBtnText}>{t('mypage.deleteNext')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.deleteBtnText}>{t('mypage.deleteFinalBtn')}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  progressBar: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingVertical: 16,
  },
  progressDot: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotActive: { backgroundColor: colors.primary },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  stepContent: { alignItems: 'center' },
  stepIcon: { marginBottom: 16 },
  stepTitle: {
    fontSize: 20, fontWeight: '700', color: colors.text,
    marginBottom: 10, textAlign: 'center',
  },
  stepDesc: {
    fontSize: 14, color: colors.textSecondary, textAlign: 'center',
    lineHeight: 21, marginBottom: 24,
  },
  // Step 1
  dataList: { width: '100%', gap: 12 },
  dataItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, padding: 14, borderRadius: 10,
  },
  dataText: { fontSize: 14, color: colors.text, flex: 1 },
  // Step 2
  reasonList: { width: '100%', gap: 8 },
  reasonItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 10, backgroundColor: colors.card,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  reasonItemActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  reasonText: { fontSize: 14, color: colors.text },
  reasonTextActive: { color: colors.primary, fontWeight: '600' },
  input: {
    width: '100%', marginTop: 12, padding: 14,
    backgroundColor: colors.card, borderRadius: 10,
    fontSize: 14, color: colors.text, minHeight: 80,
    textAlignVertical: 'top',
  },
  // Step 3
  passwordInput: {
    width: '100%', padding: 14,
    backgroundColor: colors.card, borderRadius: 10,
    fontSize: 16, color: colors.text, textAlign: 'center',
  },
  // Step 3 (social) — the nickname guidance box
  nicknameBox: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    marginBottom: 12,
  },
  nicknameHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  nicknameTarget: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  // Bottom buttons
  footer: {
    flexDirection: 'row', paddingHorizontal: 24, paddingTop: 12,
    gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  prevBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: colors.card, alignItems: 'center',
  },
  prevBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  nextBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  deleteBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#E53935', alignItems: 'center',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
