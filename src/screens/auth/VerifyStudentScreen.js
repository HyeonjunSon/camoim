import { useState, useCallback, useEffect } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { applyVerify, getVerifyStatus, getUniversities } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import AuthLangToggle from '../../components/AuthLangToggle';

// The school list is fetched from the backend /auth/universities (managed in one place)
const CURRENT_YEAR = new Date().getFullYear();
const GRADUATION_YEARS = Array.from({ length: 15 }, (_, i) => CURRENT_YEAR - i);

const statusStyle = (t) => ({
  pending:  { bg: '#FFF8E1', text: '#F59E0B', label: t('verify.stPending') },
  approved: { bg: '#E8FFF1', text: '#2D9E5A', label: t('verify.stApproved') },
  rejected: { bg: '#FFF0F0', text: '#EF4444', label: t('verify.stRejected') },
});

export default function VerifyStudentScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { user, refreshUser } = useAuth();
  const isTransfer = !!(user?.verified && user?.university);
  const { t } = useLang();
  const STATUS_STYLE = statusStyle(t);

  const [existingRequest, setExistingRequest] = useState(undefined); // undefined = not loaded yet
  const [statusLoading, setStatusLoading] = useState(true);

  const [universityList, setUniversityList] = useState([]); // Array of school shortNames from the server
  const [university, setUniversity] = useState('');
  const [studentType, setStudentType] = useState('current');
  const [graduationYear, setGraduationYear] = useState(String(CURRENT_YEAR - 1));
  const [fileUri, setFileUri] = useState(null);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showUnivPicker, setShowUnivPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkStatus();
    }, [])
  );

  // Load the school list once
  useEffect(() => {
    let mounted = true;
    getUniversities()
      .then((res) => {
        if (!mounted) return;
        if (res?.success && Array.isArray(res.data)) {
          setUniversityList(res.data.map(u => u.shortName).filter(Boolean));
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  async function checkStatus() {
    setStatusLoading(true);
    try {
      const res = await getVerifyStatus();
      setExistingRequest(res.success ? res.data : null);
    } catch (e) {
      setExistingRequest(null);
    } finally {
      setStatusLoading(false);
    }
  }

  async function pickDocument() {
    try {
      // Check the current permission state first
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(t('verify.galleryPermTitle'), t('verify.galleryPermMsg'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.openSettings'), onPress: () => Linking.openSettings() },
          ]);
        } else {
          Alert.alert(t('verify.permRequired'), t('verify.galleryRequired'));
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        setFileUri(asset.uri);
        setFileName(asset.fileName ?? `document_${Date.now()}.jpg`);
      }
    } catch (e) {
      Alert.alert(t('common.error'), `${t('verify.cantOpenGallery')}: ${e.message}`);
    }
  }

  async function takePhoto() {
    try {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(t('verify.cameraPermTitle'), t('verify.cameraPermMsg'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.openSettings'), onPress: () => Linking.openSettings() },
          ]);
        } else {
          Alert.alert(t('verify.permRequired'), t('verify.cameraRequired'));
        }
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setFileUri(result.assets[0].uri);
        setFileName(`photo_${Date.now()}.jpg`);
      }
    } catch (e) {
      Alert.alert(t('common.error'), `${t('verify.cantOpenCamera')}: ${e.message}`);
    }
  }

  async function handleSubmit() {
    if (!university) { Alert.alert(t('post.notice'), t('verify.pickSchool')); return; }
    if (!fileUri)     { Alert.alert(t('post.notice'), t('verify.pickFile')); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('university', university);
      formData.append('studentType', studentType);
      if (studentType === 'alumni') formData.append('graduationYear', graduationYear);
      // Whatever the extension (iOS HEIC and friends), the upload is always sent as .jpg
      const safeFileName = `document_${Date.now()}.jpg`;
      formData.append('file', { uri: fileUri, name: safeFileName, type: 'image/jpeg' });

      const res = await applyVerify(formData);
      if (res.success) {
        Alert.alert(t('verify.submitDone'), t('verify.submitDoneMsg'), [
          { text: t('common.ok'), onPress: () => { checkStatus(); refreshUser(); } },
        ]);
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message ?? t('verify.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading
  if (statusLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── Existing request status
  if (existingRequest) {
    const st = STATUS_STYLE[existingRequest.status] ?? STATUS_STYLE.pending;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.centeredContent}>
        <AuthLangToggle />
        <View style={styles.statusCard}>
          <Text style={styles.statusCardTitle}>{t('verify.statusTitle')}</Text>

          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusBadgeText, { color: st.text }]}>{st.label}</Text>
          </View>

          <View style={styles.statusInfoRow}>
            <Text style={styles.statusLabel}>{t('verify.school')}</Text>
            <Text style={styles.statusValue}>{existingRequest.university}</Text>
          </View>
          <View style={styles.statusInfoRow}>
            <Text style={styles.statusLabel}>{t('verify.type')}</Text>
            <Text style={styles.statusValue}>
              {existingRequest.studentType === 'current'
                ? t('verify.current')
                : t('verify.alumniYear').replace('{y}', existingRequest.graduationYear)}
            </Text>
          </View>

          {existingRequest.status === 'rejected' && existingRequest.adminNote ? (
            <View style={styles.rejectNoteBox}>
              <Text style={styles.rejectNoteLabel}>{t('verify.rejectReason')}</Text>
              <Text style={styles.rejectNoteText}>{existingRequest.adminNote}</Text>
            </View>
          ) : null}

          {existingRequest.status === 'rejected' && (
            <TouchableOpacity
              style={styles.reapplyBtn}
              onPress={() => setExistingRequest(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.reapplyBtnText}>{t('verify.reapply')}</Text>
            </TouchableOpacity>
          )}

          {existingRequest.status === 'approved' && (
            <TouchableOpacity
              style={[styles.reapplyBtn, styles.transferBtn]}
              onPress={() => setExistingRequest(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal" size={16} color={colors.white} />
              <Text style={styles.reapplyBtnText}>  {t('mypage.changeSchool')}</Text>
            </TouchableOpacity>
          )}

          {existingRequest.status === 'pending' && (
            <Text style={styles.pendingHint}>{t('verify.pendingHint')}</Text>
          )}
        </View>
      </ScrollView>
    );
  }

  // ── Request form
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthLangToggle />
      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isTransfer ? (
          <View style={[styles.infoBanner, styles.transferBanner]}>
            <Text style={styles.infoBannerTitle}>{t('verify.transferTitle')}</Text>
            <Text style={styles.transferCurrentSchool}>
              {t('verify.transferBanner').replace('{school}', user.university)}
            </Text>
            <Text style={styles.infoBannerDesc}>{t('verify.transferDesc')}</Text>
          </View>
        ) : (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerTitle}>{t('verify.bannerTitle')}</Text>
            <Text style={styles.infoBannerDesc}>{t('verify.bannerDesc')}</Text>
          </View>
        )}

        {/* School picker */}
        <Text style={styles.fieldLabel}>{t('verify.schoolLabel')}</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => { setShowUnivPicker(v => !v); setShowYearPicker(false); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.selectorText, !university && styles.placeholderText]}>
            {university || t('verify.schoolPh')}
          </Text>
          <Text style={styles.selectorChevron}>{showUnivPicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showUnivPicker && (
          <ScrollView style={styles.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {universityList.map(u => (
              <TouchableOpacity
                key={u}
                style={[styles.pickerItem, university === u && styles.pickerItemSelected]}
                onPress={() => { setUniversity(u); setShowUnivPicker(false); }}
              >
                <Text style={[styles.pickerItemText, university === u && styles.pickerItemTextSelected]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Student / alumnus */}
        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>{t('verify.typeLabel')}</Text>
        <View style={styles.typeRow}>
          {[
            { key: 'current', label: t('verify.currentBtn') },
            { key: 'alumni',  label: t('verify.alumniBtn') },
          ].map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.typeBtn, studentType === opt.key && styles.typeBtnActive]}
              onPress={() => setStudentType(opt.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.typeBtnText, studentType === opt.key && styles.typeBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Graduation year */}
        {studentType === 'alumni' && (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>{t('verify.gradYearLabel')}</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => { setShowYearPicker(v => !v); setShowUnivPicker(false); }}
              activeOpacity={0.8}
            >
              <Text style={styles.selectorText}>{graduationYear}{t('verify.yearSuffix')}</Text>
              <Text style={styles.selectorChevron}>{showYearPicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showYearPicker && (
              <ScrollView style={styles.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {GRADUATION_YEARS.map(y => (
                  <TouchableOpacity
                    key={y}
                    style={[styles.pickerItem, String(y) === graduationYear && styles.pickerItemSelected]}
                    onPress={() => { setGraduationYear(String(y)); setShowYearPicker(false); }}
                  >
                    <Text style={[styles.pickerItemText, String(y) === graduationYear && styles.pickerItemTextSelected]}>
                      {y}{t('verify.yearSuffix')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* Attach documents */}
        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>{t('verify.docLabel')}</Text>
        <Text style={styles.fieldHint}>{t('verify.docHint')}</Text>

        {fileUri ? (
          <View style={styles.filePreviewBox}>
            <Image source={{ uri: fileUri }} style={styles.filePreview} resizeMode="cover" />
            <TouchableOpacity
              style={styles.fileRemoveBtn}
              onPress={() => { setFileUri(null); setFileName(''); }}
            >
              <Text style={styles.fileRemoveText}>{t('verify.reSelect')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.filePickerRow}>
            <TouchableOpacity style={styles.filePickerBtn} onPress={pickDocument} activeOpacity={0.8}>
              <Ionicons name="image-outline" size={26} color={colors.textSecondary} style={{ marginBottom: 6 }} />
              <Text style={styles.filePickerText}>{t('verify.gallery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filePickerBtn} onPress={takePhoto} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={26} color={colors.textSecondary} style={{ marginBottom: 6 }} />
              <Text style={styles.filePickerText}>{t('verify.camera')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!university || !fileUri || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!university || !fileUri || submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.submitBtnText}>{t('verify.submitBtn')}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  centeredContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  formContent: { padding: 20, paddingBottom: 40 },
  infoBanner: {
    backgroundColor: colors.primary + '12', borderRadius: 14, padding: 16, marginBottom: 20,
  },
  transferBanner: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  transferCurrentSchool: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  infoBannerTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  infoBannerDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  fieldHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 10, lineHeight: 18 },
  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.inputBg, borderRadius: 12, padding: 14,
  },
  selectorText: { fontSize: 14, color: colors.text },
  selectorChevron: { fontSize: 14, color: colors.textSecondary },
  placeholderText: { color: colors.textSecondary },
  pickerList: {
    backgroundColor: colors.surface, borderRadius: 12, marginTop: 6,
    borderWidth: 1, borderColor: colors.border, maxHeight: 250, overflow: 'hidden',
  },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 12 },
  pickerItemSelected: { backgroundColor: colors.primary + '12' },
  pickerItemText: { fontSize: 14, color: colors.text },
  pickerItemTextSelected: { color: colors.primary, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.inputBg, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent',
  },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  typeBtnTextActive: { color: colors.primary },
  filePickerRow: { flexDirection: 'row', gap: 12 },
  filePickerBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.inputBg, borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  filePickerText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  filePreviewBox: { borderRadius: 14, overflow: 'hidden' },
  filePreview: { width: '100%', height: 200, borderRadius: 14 },
  fileRemoveBtn: {
    marginTop: 8, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: colors.inputBg, borderRadius: 8,
  },
  fileRemoveText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  statusCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: 'center',
  },
  statusCardTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, marginBottom: 20 },
  statusBadgeText: { fontSize: 14, fontWeight: '700' },
  statusInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between', width: '100%',
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  statusLabel: { fontSize: 13, color: colors.textSecondary },
  statusValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  rejectNoteBox: {
    backgroundColor: colors.danger + '15', borderRadius: 10, padding: 12, marginTop: 16, width: '100%',
  },
  rejectNoteLabel: { fontSize: 12, fontWeight: '600', color: colors.danger, marginBottom: 4 },
  rejectNoteText: { fontSize: 13, color: colors.text, lineHeight: 20 },
  transferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  reapplyBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 20,
  },
  reapplyBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  pendingHint: { fontSize: 13, color: colors.textSecondary, marginTop: 16, textAlign: 'center' },
});
