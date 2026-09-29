import { useState } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { approveVerifyRequest, rejectVerifyRequest } from '../../lib/api';

import { SERVER_HOST as SERVER_BASE } from '../../lib/config';
import { useLang } from '../../context/LangContext';

export default function AdminDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { request } = route.params ?? {};
  const { t } = useLang();

  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    Alert.alert(
      t('admin.approveAskTitle'),
      t('admin.approveAskMsg').replace('{nick}', request.nickname).replace('{uni}', request.university),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.approveActionShort'),
          onPress: async () => {
            setLoading(true);
            try {
              await approveVerifyRequest(request.id);
              Alert.alert(t('common.done'), t('admin.approveDone'), [
                { text: t('common.ok'), onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              Alert.alert(t('common.error'), e.message ?? t('admin.approveFailed'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  async function handleReject() {
    if (!rejectNote.trim()) {
      Alert.alert(t('post.notice'), t('admin.enterRejectReason'));
      return;
    }
    Alert.alert(
      t('admin.rejectAskTitle'),
      t('admin.rejectAskMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.rejectActionShort'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await rejectVerifyRequest(request.id, rejectNote.trim());
              Alert.alert(t('common.done'), t('admin.rejectDone'), [
                { text: t('common.ok'), onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              Alert.alert(t('common.error'), e.message ?? t('admin.rejectFailed'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  if (!request) return null;

  const isPending = request.status === 'pending';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* User details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.applicantInfo')}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('admin.lblNick')}</Text>
            <Text style={styles.infoValue}>{request.nickname}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('admin.lblEmail')}</Text>
            <Text style={styles.infoValue}>{request.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('admin.lblSchool')}</Text>
            <Text style={styles.infoValue}>{request.university}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('admin.lblType')}</Text>
            <Text style={styles.infoValue}>
              {request.studentType === 'current' ? t('verify.current') : t('verify.alumniYear').replace('{y}', request.graduationYear)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('admin.lblDate')}</Text>
            <Text style={styles.infoValue}>
              {new Date(request.createdAt).toLocaleDateString('ko-KR')}
            </Text>
          </View>
        </View>

        {/* Attached documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.docAttached')}</Text>
          {request.fileUrl ? (
            <Image
              source={{ uri: /^https?:\/\//.test(request.fileUrl) ? request.fileUrl : `${SERVER_BASE}${request.fileUrl}` }}
              style={styles.docImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.noFile}>{t('admin.noFile')}</Text>
          )}
        </View>

        {/* Approve/reject buttons (only while pending) */}
        {isPending && !loading && (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={handleApprove}
              activeOpacity={0.85}
            >
              <Text style={styles.approveBtnText}>{t('admin.approveBtn')}</Text>
            </TouchableOpacity>

            {!showRejectInput ? (
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => setShowRejectInput(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.rejectBtnText}>{t('admin.rejectBtn')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.rejectInputBox}>
                <TextInput
                  style={styles.rejectInput}
                  placeholder={t('admin.rejectReasonPh')}
                  placeholderTextColor={colors.textSecondary}
                  value={rejectNote}
                  onChangeText={setRejectNote}
                  multiline
                  maxLength={200}
                />
                <View style={styles.rejectInputActions}>
                  <TouchableOpacity
                    style={styles.cancelSmallBtn}
                    onPress={() => { setShowRejectInput(false); setRejectNote(''); }}
                  >
                    <Text style={styles.cancelSmallText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectConfirmBtn} onPress={handleReject}>
                    <Text style={styles.rejectConfirmText}>{t('admin.rejectConfirm')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* Already handled */}
        {!isPending && (
          <View style={styles.doneBox}>
            <Text style={styles.doneText}>
              {request.status === 'approved' ? t('admin.alreadyApproved') : t('admin.alreadyRejected')}
            </Text>
            {request.adminNote ? (
              <Text style={styles.doneNote}>{t('admin.doneRejectReason')}: {request.adminNote}</Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 12 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  infoLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: '500' },
  docImage: { width: '100%', height: 300, borderRadius: 10, backgroundColor: colors.inputBg },
  noFile: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', padding: 20 },
  actionSection: { gap: 12, marginTop: 8 },
  approveBtn: {
    backgroundColor: '#10B981', borderRadius: 12, padding: 16, alignItems: 'center',
  },
  approveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  rejectBtn: {
    backgroundColor: colors.danger, borderRadius: 12, padding: 16, alignItems: 'center',
  },
  rejectBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  rejectInputBox: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.danger,
  },
  rejectInput: {
    backgroundColor: colors.inputBg, borderRadius: 10, padding: 12,
    fontSize: 14, color: colors.text, minHeight: 60,
  },
  rejectInputActions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end' },
  cancelSmallBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.inputBg },
  cancelSmallText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  rejectConfirmBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.danger },
  rejectConfirmText: { fontSize: 13, color: colors.white, fontWeight: '700' },
  loadingBox: { padding: 40, alignItems: 'center' },
  doneBox: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 20, alignItems: 'center', marginTop: 8,
  },
  doneText: { fontSize: 15, fontWeight: '700', color: colors.text },
  doneNote: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
});
