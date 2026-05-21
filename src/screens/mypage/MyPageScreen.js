import { useState, useCallback } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getMyPosts, updateProfile, checkNickname, uploadAvatar } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors';
import Avatar from '../../components/common/Avatar';
import RoleBadge from '../../components/RoleBadge';

const APP_VERSION = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

// 도시 목록 (Signup 화면과 동일)
const CITIES = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton',
  'Ottawa', 'Winnipeg', 'Victoria', 'Halifax', 'Saskatoon',
  'London', 'Quebec',
];

// 학교 리스트는 백엔드 /auth/universities 에서 fetch — useState로 관리

// 마이페이지 화면 — 프로필 + 통계 + 메뉴
export default function MyPageScreen({ navigation }) {
  const { colors, mode: themeMode, setMode: setThemeMode } = useTheme();
  const styles = createStyles(colors);
  const { user, logout, refreshUser } = useAuth();
  const { lang, setLang, t } = useLang();
  const insets = useSafeAreaInsets();

  const [myPosts, setMyPosts] = useState([]);
  const [totalPosts, setTotalPosts] = useState(0);

  // 프로필 수정 모달 상태
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    nickname: '', city: '',
  });
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [nickChecked, setNickChecked] = useState(false);
  const [nickChecking, setNickChecking] = useState(false);
  const [nickMsg, setNickMsg] = useState('');

  const onChangeNickname = (v) => {
    setEditForm(prev => ({ ...prev, nickname: v }));
    // 본인 닉네임 그대로면 자동 통과
    if (v.trim() === (user?.nickname ?? '').trim()) {
      setNickChecked(true);
      setNickMsg('');
    } else {
      setNickChecked(false);
      setNickMsg('');
    }
  };

  const handleCheckNickname = async () => {
    const v = editForm.nickname.trim();
    if (v.length < 2 || v.length > 20) {
      setNickMsg(t('auth.checkLen'));
      setNickChecked(false);
      return;
    }
    setNickChecking(true);
    try {
      const res = await checkNickname(v);
      if (res.success && res.data.available) {
        setNickChecked(true);
        setNickMsg(t('auth.checkOk'));
      } else {
        setNickChecked(false);
        setNickMsg(t('auth.checkDup'));
      }
    } catch (e) {
      setNickChecked(false);
      setNickMsg(e.message ?? t('mypage.profileFailed'));
    } finally {
      setNickChecking(false);
    }
  };

  // 내 게시글 로드 (통계 계산용)
  const loadMyPosts = useCallback(async () => {
    try {
      const res = await getMyPosts(1);
      if (res.success) {
        setMyPosts(res.data.posts ?? []);
        setTotalPosts(res.data.total ?? 0);
      }
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { loadMyPosts(); }, [loadMyPosts]));

  // 통계 계산
  const totalLikes = myPosts.reduce((sum, p) => sum + (p.likeCount ?? 0), 0);
  const totalComments = myPosts.reduce((sum, p) => sum + (p.commentCount ?? 0), 0);

  // 프로필 수정
  const openEditModal = () => {
    setEditForm({
      nickname: user?.nickname ?? '',
      city: user?.city ?? '',
    });
    setNickChecked(true); // 본인 기존 닉네임은 통과 상태로 시작
    setNickMsg('');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editForm.nickname.trim()) {
      Alert.alert(t('common.confirm'), t('mypage.enterNickname'));
      return;
    }
    if (!nickChecked) {
      Alert.alert(t('common.confirm'), t('auth.needCheck'));
      return;
    }
    setSaving(true);
    try {
      const res = await updateProfile({
        nickname: editForm.nickname.trim(),
        city: editForm.city,
      });
      if (res.success) {
        await refreshUser();
        setEditModalVisible(false);
        Alert.alert(t('common.success'), t('mypage.profileUpdated'));
      } else {
        Alert.alert(t('common.error'), res.message ?? t('mypage.profileFailed'));
      }
    } catch {
      Alert.alert(t('common.error'), t('mypage.profileFailed'));
    } finally {
      setSaving(false);
    }
  };

  // 프로필 사진 변경 — 갤러리에서 선택 → Cloudinary 업로드
  const handleChangeAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('post.permRequired'), t('post.permPhotoMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      const res = await uploadAvatar({
        uri: manipulated.uri,
        filename: `avatar_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      if (res?.success) {
        await refreshUser();
      } else {
        Alert.alert(t('common.error'), res?.message || t('common.serverError'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('common.serverError'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 아바타 탭 시 선택지 — 사진 변경 / 프로필 수정
  const handleAvatarPress = () => {
    Alert.alert(
      t('mypage.editProfile'),
      null,
      [
        { text: t('mypage.changePhoto'), onPress: handleChangeAvatar },
        { text: t('mypage.editProfile'), onPress: openEditModal },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  // 로그아웃
  const handleLogout = () => {
    Alert.alert(t('mypage.logout'), t('mypage.logoutAsk'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mypage.logout'), style: 'destructive', onPress: () => logout().catch(() => {}) },
    ]);
  };

  // 회원탈퇴 — 4단계 탈퇴 화면으로 이동
  const handleDeleteAccount = () => {
    navigation.navigate('DeleteAccount');
  };

  // 준비중 공용 핸들러
  const showComingSoon = (label) => {
    Alert.alert(label, 'Coming soon');
  };

  // 메뉴 아이템 컴포넌트
  const MenuItem = ({ icon, label, sub, onPress, danger, rightText, last }) => (
    <TouchableOpacity
      style={[styles.menuRow, !last && styles.menuRowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={[styles.menuIconBox, danger && styles.menuIconBoxDanger]}>
        <Ionicons
          name={icon}
          size={18}
          color={danger ? '#EF4444' : colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, danger && { color: '#EF4444' }]}>{label}</Text>
        {sub && <Text style={styles.menuSub}>{sub}</Text>}
      </View>
      {rightText
        ? <Text style={styles.menuRightText}>{rightText}</Text>
        : onPress && <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      }
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── 프로필 카드 ── */}
        <View style={[styles.profileCard, { paddingTop: insets.top + 20 }]}>
          {/* 아바타 + 편집 오버레이 */}
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85} disabled={uploadingAvatar}>
            <View style={styles.avatarWrap}>
              <Avatar nickname={user?.nickname} uri={user?.avatarUrl} size={92} showLetter />
              <View style={styles.editOverlay}>
                {uploadingAvatar
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Ionicons name="camera" size={14} color={colors.white} />}
              </View>
            </View>
          </TouchableOpacity>

          {/* 닉네임 + 역할 뱃지 */}
          <View style={styles.nameRow}>
            <Text style={styles.nickname}>{user?.nickname ?? t('common.anonymous')}</Text>
            {user?.role ? <RoleBadge role={user.role} size="large" /> : null}
          </View>

          {/* 이메일 */}
          {user?.email && <Text style={styles.email}>{user.email}</Text>}

          {/* 학교 또는 도시 */}
          {user?.university ? (
            <Text style={styles.subInfo}>
              🎓 {user.university} {user?.verified ? '✓' : ''}
            </Text>
          ) : user?.city ? (
            <Text style={styles.subInfo}>📍 {user.city}</Text>
          ) : null}
        </View>

        {/* ── 통계 카드 (3컬럼) ── */}
        <View style={styles.statsCard}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.navigate('MyPosts')}
            activeOpacity={0.7}
          >
            <Text style={styles.statValue}>{totalPosts}</Text>
            <Text style={styles.statLabel}>{t('mypage.myPosts')}</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalLikes}</Text>
            <Text style={styles.statLabel}>{t('mypage.receivedLikes')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalComments}</Text>
            <Text style={styles.statLabel}>{t('mypage.receivedComments')}</Text>
          </View>
        </View>

        {/* ── 활동 ── */}
        <Text style={styles.sectionLabel}>{t('mypage.sectionActivity')}</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="document-text-outline"
            label={t('mypage.myPosts')}
            onPress={() => navigation.navigate('MyPosts')}
          />
          <MenuItem
            icon="heart-outline"
            label={t('mypage.likedPosts')}
            onPress={() => navigation.navigate('LikedPosts')}
          />
          <MenuItem
            icon="bookmark-outline"
            label={t('mypage.bookmarkedPosts')}
            onPress={() => navigation.navigate('BookmarkedPosts')}
            last
          />
        </View>

        {/* ── 계정 ── */}
        <Text style={styles.sectionLabel}>{t('mypage.sectionAccount')}</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="person-outline"
            label={t('mypage.editProfile')}
            onPress={openEditModal}
            last={user?.role !== 'student'}
          />
          {user?.role === 'student' && (
            <MenuItem
              icon="school-outline"
              label={t('mypage.verifyStudent')}
              sub={user?.verified ? `✓ ${t('board.verified')} — ${user.university}` : t('auth.verifyEmailHint')}
              onPress={() => navigation.navigate('VerifyStudent')}
              last
            />
          )}
        </View>

        {/* ── 언어 ── */}
        <Text style={styles.sectionLabel}>{t('mypage.sectionLanguage')}</Text>
        <View style={styles.menuCard}>
          <View style={[styles.menuRow]}>
            <View style={styles.menuIconBox}>
              <Ionicons name="language-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.menuLabel, { flex: 1 }]}>{t('mypage.language')}</Text>
            <View style={styles.langSwitch}>
              <TouchableOpacity
                style={[styles.langOpt, lang === 'ko' && styles.langOptActive]}
                onPress={() => setLang('ko')}
                activeOpacity={0.8}
              >
                <Text style={[styles.langOptText, lang === 'ko' && styles.langOptTextActive]}>한국어</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langOpt, lang === 'en' && styles.langOptActive]}
                onPress={() => setLang('en')}
                activeOpacity={0.8}
              >
                <Text style={[styles.langOptText, lang === 'en' && styles.langOptTextActive]}>English</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── 테마 ── */}
        <Text style={styles.sectionLabel}>{t('mypage.sectionTheme')}</Text>
        <View style={styles.menuCard}>
          <View style={[styles.menuRow]}>
            <View style={styles.menuIconBox}>
              <Ionicons name="moon-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.menuLabel, { flex: 1 }]}>{t('mypage.theme')}</Text>
            <View style={styles.langSwitch}>
              <TouchableOpacity
                style={[styles.langOpt, themeMode === 'light' && styles.langOptActive]}
                onPress={() => setThemeMode('light')}
                activeOpacity={0.8}
              >
                <Text style={[styles.langOptText, themeMode === 'light' && styles.langOptTextActive]}>{t('mypage.themeLight')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langOpt, themeMode === 'dark' && styles.langOptActive]}
                onPress={() => setThemeMode('dark')}
                activeOpacity={0.8}
              >
                <Text style={[styles.langOptText, themeMode === 'dark' && styles.langOptTextActive]}>{t('mypage.themeDark')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── 알림 & 차단 ── */}
        <Text style={styles.sectionLabel}>{t('mypage.sectionAlert')}</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="notifications-outline"
            label={t('mypage.notifSettings')}
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <MenuItem
            icon="ban-outline"
            label={t('mypage.blockedUsers')}
            onPress={() => navigation.navigate('BlockedUsers')}
            last
          />
        </View>

        {/* ── 정보 ── */}
        <Text style={styles.sectionLabel}>{t('mypage.sectionInfo')}</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="megaphone-outline"
            label={t('mypage.notice')}
            onPress={() => navigation.navigate('Notices')}
          />
          <MenuItem
            icon="help-circle-outline"
            label={t('mypage.support')}
            onPress={() => navigation.navigate('Support')}
          />
          <MenuItem
            icon="document-outline"
            label={t('mypage.terms')}
            onPress={() => navigation.navigate('LegalDoc', { type: 'terms' })}
          />
          <MenuItem
            icon="lock-closed-outline"
            label={t('mypage.privacy')}
            onPress={() => navigation.navigate('LegalDoc', { type: 'privacy' })}
          />
          <MenuItem
            icon="information-circle-outline"
            label={t('mypage.version')}
            rightText={APP_VERSION}
            last
          />
        </View>

        {/* ── 계정 ── */}
        <Text style={styles.sectionLabel}>{t('mypage.sectionAccount')}</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="log-out-outline"
            label={t('mypage.logout')}
            onPress={handleLogout}
          />
          <MenuItem
            icon="trash-outline"
            label={t('mypage.deleteAccount')}
            onPress={handleDeleteAccount}
            danger
            last
          />
        </View>
      </ScrollView>

      {/* ─── 프로필 수정 모달 ─── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('mypage.editProfile')}</Text>
              <TouchableOpacity onPress={handleSaveProfile} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              {/* 현재 아바타 미리보기 + 변경 버튼 */}
              <TouchableOpacity style={styles.modalAvatarWrap} onPress={handleChangeAvatar} disabled={uploadingAvatar} activeOpacity={0.8}>
                <Avatar nickname={user?.nickname} uri={user?.avatarUrl} size={72} showLetter />
                <Text style={styles.modalAvatarText}>{t('mypage.changePhoto')}</Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>{t('auth.nickname')}</Text>
              <View style={styles.nickRow}>
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={editForm.nickname}
                  onChangeText={onChangeNickname}
                  placeholder={t('auth.nickname')}
                  placeholderTextColor={colors.textSecondary}
                  maxLength={20}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.checkBtn, nickChecked && styles.checkBtnDone]}
                  onPress={handleCheckNickname}
                  disabled={nickChecking || nickChecked}
                  activeOpacity={0.8}
                >
                  {nickChecking
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.checkBtnText}>{nickChecked ? t('auth.checkDone') : t('auth.checkNickname')}</Text>}
                </TouchableOpacity>
              </View>
              {nickMsg ? (
                <Text style={[styles.nickMsg, nickChecked && styles.nickMsgOk]}>{nickMsg}</Text>
              ) : null}
              <Text style={styles.fieldLabel}>{t('mypage.region')}</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setCityModalOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dropdownText, !editForm.city && styles.dropdownPlaceholder]}>
                  {editForm.city ? (t(`city.${editForm.city}`) || editForm.city) : t('mypage.regionPlaceholder')}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* 학교 섹션은 학생 role 또는 이미 인증된 회원에게만 노출
                  (일반/워홀/기타 회원은 학교 인증 대상이 아님) */}
              {(user?.role === 'student' || (user?.verified && user?.university)) && (
                <>
                  <Text style={styles.fieldLabel}>{t('mypage.school')}</Text>
                  {user?.verified && user?.university ? (
                    // 인증된 사용자: 학교 read-only + 변경 버튼
                    <View>
                      <View style={styles.schoolReadOnly}>
                        <Text style={styles.schoolReadOnlyText}>🎓 {user.university}</Text>
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                          <Text style={styles.verifiedBadgeText}>{t('mypage.schoolVerified')}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.changeSchoolBtn}
                        onPress={() => {
                          setEditModalVisible(false);
                          setTimeout(() => navigation.navigate('VerifyStudent'), 250);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                        <Text style={styles.changeSchoolBtnText}>{t('mypage.changeSchool')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    // 미인증 학생: 학교 인증 CTA
                    <View style={styles.verifyCta}>
                      <Text style={styles.verifyCtaText}>{t('mypage.verifyHint')}</Text>
                      <TouchableOpacity
                        style={styles.verifyCtaBtn}
                        onPress={() => {
                          setEditModalVisible(false);
                          setTimeout(() => navigation.navigate('VerifyStudent'), 250);
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="school-outline" size={16} color={colors.white} />
                        <Text style={styles.verifyCtaBtnText}>{t('mypage.verifySchool')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* 도시 선택 모달 */}
        <Modal
          visible={cityModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setCityModalOpen(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{t('home.regionFilter')}</Text>
                <TouchableOpacity onPress={() => setCityModalOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.pickerItem, !editForm.city && styles.pickerItemActive]}
                onPress={() => { setEditForm(p => ({ ...p, city: '' })); setCityModalOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerItemText, !editForm.city && styles.pickerItemTextActive]}>
                  {t('auth.citySkip')}
                </Text>
              </TouchableOpacity>
              <FlatList
                data={CITIES}
                keyExtractor={item => item}
                renderItem={({ item: c }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, editForm.city === c && styles.pickerItemActive]}
                    onPress={() => { setEditForm(p => ({ ...p, city: c })); setCityModalOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerItemText, editForm.city === c && styles.pickerItemTextActive]}>
                      📍 {t(`city.${c}`) || c}
                    </Text>
                    {editForm.city === c && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 400 }}
              />
            </View>
          </View>
        </Modal>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── 프로필 카드
  profileCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  editOverlay: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  nickname: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subInfo: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
  },

  // ── 통계 카드
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: 14,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  // ── 메뉴 섹션
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 22,
  },
  menuCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 14,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconBoxDanger: {
    backgroundColor: colors.danger + '15',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  menuSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuRightText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },


  // ── 프로필 수정 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle:      { fontSize: 16, fontWeight: '700', color: colors.text },
  modalCancelText: { fontSize: 15, color: colors.textSecondary },
  modalSaveText:   { fontSize: 15, color: colors.primary, fontWeight: '700' },
  modalContent:    { padding: 16, gap: 4, paddingBottom: 40 },
  modalAvatarWrap: { alignItems: 'center', marginBottom: 8 },
  modalAvatarText: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 8 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: colors.textSecondary,
  },
  // 인증된 학교 read-only 표시
  schoolReadOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.successSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  schoolReadOnlyText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.success + '20',
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  changeSchoolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  changeSchoolBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  // 미인증 사용자 학교 인증 CTA
  verifyCta: {
    backgroundColor: colors.primary + '10',
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  verifyCtaText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  verifyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
  },
  verifyCtaBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '75%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerItemActive: {
    backgroundColor: colors.primary + '10',
  },
  pickerItemText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  pickerItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  nickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkBtn: {
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: {
    backgroundColor: '#10B981',
  },
  checkBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  nickMsg: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
  },
  nickMsgOk: {
    color: '#10B981',
  },
  langSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  langOpt: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  langOptActive: {
    backgroundColor: colors.primary,
  },
  langOptText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  langOptTextActive: {
    color: colors.white,
  },
});
