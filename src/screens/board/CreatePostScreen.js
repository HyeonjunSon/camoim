import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  StyleSheet,
  ScrollView,
  Keyboard,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { uploadPostImage, listDrafts, createDraft, updateDraft, deleteDraft } from '../../lib/api';
import { getToken } from '../../lib/storage';
import { API_BASE_URL, SERVER_HOST } from '../../lib/config';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';

const BASE_URL = API_BASE_URL;

const LOCAL_BOARD_SLUGS = ['market', 'jobs', 'roomrent', 'car', 'giveaway', 'realestate', 'meetup'];
const CITIES = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton',
  'Ottawa', 'Winnipeg', 'Victoria', 'Halifax', 'Saskatoon',
  'London', 'Quebec',
];

// 저장된 HTML → 에디터용 (상대 /uploads/ → 절대 URL, 잔존 ✕ 래퍼 제거)
function contentToHtml(content) {
  if (!content) return '';
  let out = content;
  // 과거 주입으로 박힌 ✕ 버튼/래퍼 제거 (방어)
  out = out.replace(/<span[^>]*data-img-del[^>]*>[\s\S]*?<\/span>/gi, '');
  out = out.replace(/<span[^>]*data-img-wrap[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  // 시작/끝/중간 빈 블록 정리 — P와 DIV 모두 대응 (pell-rich-editor 기본이 div)
  const emptyBlock = /<(?:p|div)[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/(?:p|div)>/i;
  // 맨 앞 빈 블록/br/공백 전부 제거 (leading)
  out = out.replace(new RegExp(`^(\\s|<br\\s*\\/?>|${emptyBlock.source})+`, 'i'), '');
  // 끝 빈 블록/br 전부 제거 (trailing)
  out = out.replace(new RegExp(`(\\s|<br\\s*\\/?>|${emptyBlock.source})+$`, 'i'), '');
  // 연속된 빈 블록을 하나로 축약
  out = out.replace(new RegExp(`(${emptyBlock.source})(\\s*${emptyBlock.source})+`, 'gi'), '<p><br></p>');
  // /uploads/ → 절대 URL
  out = out.replace(/src=["'](\/uploads\/[^"']+)["']/g, `src="${SERVER_HOST}$1"`);
  return out;
}

// 저장 시: 잔존 래퍼 제거 + 로컬 URL은 상대 경로로 변환 (Cloudinary URL은 그대로 유지)
function normalizeHtmlForSave(html) {
  if (!html) return '';
  let out = html;
  out = out.replace(/<span[^>]*data-img-del[^>]*>[\s\S]*?<\/span>/gi, '');
  out = out.replace(/<span[^>]*data-img-wrap[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  // "글 추가" 힌트 제거
  out = out.replace(/<p[^>]*data-add-hint[^>]*>[\s\S]*?<\/p>/gi, '');
  // data-fresh 속성 정리
  out = out.replace(/\s*data-fresh="[^"]*"/gi, '');
  // 이미지 액션바(혹시라도 직렬화되면) 제거
  out = out.replace(/<div[^>]*id=["']__imgActionBar["'][^>]*>[\s\S]*?<\/div>/gi, '');
  // 시작/끝/중간 빈 블록 정리 — P와 DIV 모두 대응
  const emptyBlock = /<(?:p|div)[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/(?:p|div)>/i;
  out = out.replace(new RegExp(`^(\\s|<br\\s*\\/?>|${emptyBlock.source})+`, 'i'), '');
  out = out.replace(new RegExp(`(\\s|<br\\s*\\/?>|${emptyBlock.source})+$`, 'i'), '');
  out = out.replace(new RegExp(`(${emptyBlock.source})(\\s*${emptyBlock.source})+`, 'gi'), '<p><br></p>');
  // 로컬 서버 URL만 상대 경로로 변환 (Cloudinary URL은 절대 URL 그대로 유지)
  const escaped = SERVER_HOST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  out = out.replace(new RegExp(`src=["']${escaped}(/uploads/[^"']+)["']`, 'g'), 'src="$1"');
  return out;
}

export default function CreatePostScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const routeParams = route.params ?? {};
  const editPost = routeParams.editPost;
  const isEditMode = !!editPost;
  // 수정 모드일 때는 editPost에서 보드 정보를 가져옴 (네비게이션이 editPost만 넘기는 경우 대응)
  const boardId = routeParams.boardId ?? editPost?.boardId;
  const boardSlug = routeParams.boardSlug ?? editPost?.boardSlug;
  const boardName = routeParams.boardName ?? editPost?.boardName;
  // 모임 게시판 글: groupId가 있으면 board 로직 우회
  const groupId = routeParams.groupId ?? editPost?.groupId;
  const groupName = routeParams.groupName ?? editPost?.groupName;
  const isGroupPost = !!groupId;
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();

  const isLocalBoard = LOCAL_BOARD_SLUGS.includes(boardSlug);
  // 익명 게시판 판별: 'anonymous' 또는 '{school}-anonymous'
  const isAnonymousBoard = boardSlug === 'anonymous' || /(^|-)anonymous$/.test(boardSlug || '');
  const [selectedCity, setSelectedCity] = useState(isEditMode ? (editPost?.city || '') : (user?.city || ''));
  const [cityModalOpen, setCityModalOpen] = useState(false);

  const [title, setTitle] = useState(editPost?.title ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [hasBody, setHasBody] = useState(!!editPost?.content);
  const [kbHeight, setKbHeight] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imgSelected, setImgSelected] = useState(false);
  const [boldActive, setBoldActive] = useState(false);
  const [h2Active, setH2Active] = useState(false);

  const richRef = useRef(null);
  const scrollRef = useRef(null);
  const scrollViewHeightRef = useRef(0);

  const initialHtmlRef = useRef(
    isEditMode ? contentToHtml(editPost.content ?? '') : ''
  );
  const currentHtml = useRef(initialHtmlRef.current);

  // 임시저장 (드래프트) — 수정 모드에선 비활성
  const [drafts, setDrafts] = useState([]);
  const [draftsModalOpen, setDraftsModalOpen] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const draftsEnabled = !isEditMode && !isGroupPost;

  // 본문 에디터 포커스 여부 — 툴바를 본문 편집 중일 때만 노출
  const [editorFocused, setEditorFocused] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!draftsEnabled) return;
    (async () => {
      try {
        const res = await listDrafts();
        if (res.success) setDrafts(res.data || []);
      } catch {}
    })();
  }, [draftsEnabled]);

  const refreshDrafts = async () => {
    try {
      const res = await listDrafts();
      if (res.success) setDrafts(res.data || []);
    } catch {}
  };

  const onLoadDraft = (d) => {
    setCurrentDraftId(d.id ?? d._id);
    setTitle(d.title || '');
    if (d.city !== undefined) setSelectedCity(d.city || '');
    const html = contentToHtml(d.content || '');
    currentHtml.current = html;
    setHasBody(!!html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim() || /<img/i.test(html));
    try { richRef.current?.setContentHTML(html); } catch {}
    setDraftsModalOpen(false);
  };

  const onDeleteDraft = async (id) => {
    try {
      await deleteDraft(id);
      if (String(id) === String(currentDraftId)) setCurrentDraftId(null);
      await refreshDrafts();
    } catch (e) { Alert.alert(t('common.error'), e.message || t('common.serverError')); }
  };

  // 💾 임시저장 버튼 — 명시적 저장만, 자동 안 됨
  const onSaveDraft = async () => {
    let html = currentHtml.current;
    try {
      const fetched = await richRef.current?.getContentHtml?.();
      if (typeof fetched === 'string') html = fetched;
    } catch {}
    const cleaned = normalizeHtmlForSave(html);
    const stripped = cleaned.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
    const hasContent = !!title.trim() || stripped.length > 0 || /<img/i.test(cleaned);
    if (!hasContent) {
      Alert.alert('', t('draft.emptyContent'));
      return;
    }
    try {
      const payload = {
        boardId: boardId || null,
        title: title.trim(),
        content: cleaned,
        isAnonymous: isAnonymousBoard,
        city: selectedCity || '',
      };
      if (currentDraftId) await updateDraft(currentDraftId, payload);
      else {
        const res = await createDraft(payload);
        if (res.success && res.data) {
          setCurrentDraftId(res.data.id ?? res.data._id);
        }
      }
      await refreshDrafts();
      Alert.alert('', t('draft.saved'));
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('common.serverError'));
    }
  };

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s1 = Keyboard.addListener(showEvt, (e) => setKbHeight(e?.endCoordinates?.height ?? 0));
    const s2 = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleChangeHtml = (html) => {
    currentHtml.current = html;
    // <p><br></p> 같은 공백 HTML도 빈 것으로 간주
    const stripped = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
    setHasBody(stripped.length > 0 || /<img/i.test(html));
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('post.permRequired'), t('post.permPhotoMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingImage(true);
    try {
      // 가로 1280px, JPEG 70%로 리사이즈/압축 (보통 5MB → 200~400KB)
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      const res = await uploadPostImage({
        uri: manipulated.uri,
        filename: `post_img_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      if (res.success) {
        // Cloudinary는 절대 URL 반환, 로컬은 /uploads/... 상대 경로
        const imgUrl = res.data.url.startsWith('http') ? res.data.url : `${SERVER_HOST}${res.data.url}`;
        const html = `<p><img src="${imgUrl}" /></p><p><br></p>`;
        try { richRef.current?.insertHTML(html); }
        catch (e) { richRef.current?.insertImage(imgUrl); }
        // 새 이미지 로드 후 리플로우 + 힌트 재계산
        const reflowJS = `
          (function(){
            var imgs = document.querySelectorAll('img');
            var last = imgs[imgs.length - 1];
            function refresh(){
              document.body.style.display='none';
              void document.body.offsetHeight;
              document.body.style.display='';
              var ev = document.createEvent('Event');
              ev.initEvent('input', true, true);
              (document.querySelector('[contenteditable]')||document.body).dispatchEvent(ev);
              // 이미지 삽입 후 힌트 즉시 재계산 (사진 사이에 힌트 표시)
              if (window.__decorateHints) window.__decorateHints();
            }
            if (!last || last.complete) refresh();
            else {
              last.addEventListener('load', refresh);
              last.addEventListener('error', refresh);
            }
            true;
          })();
        `;
        setTimeout(() => {
          try { richRef.current?.injectJavascript?.(reflowJS); } catch (e) {}
        }, 80);
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message ?? t('post.uploadFailed'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEditorMessage = (message) => {
    // pell-rich-editor는 {type, data} 객체로 전달
    const type = message?.type;
    if (type === 'IMG_SELECTED') setImgSelected(true);
    else if (type === 'IMG_DESELECTED') setImgSelected(false);
    else if (type === 'FMT_STATE') {
      setBoldActive(!!message?.data?.bold);
      setH2Active(!!message?.data?.h2);
    }
  };

  const deleteSelectedImage = () => {
    const js = `
      (function(){
        var img = window.__selectedImg;
        if (img) {
          var p = img.parentNode;
          if (p && p.nodeName === 'P' && p.children.length === 1) p.parentNode.removeChild(p);
          else img.parentNode.removeChild(img);
          window.__selectedImg = null;
          var ev = document.createEvent('Event');
          ev.initEvent('input', true, true);
          (document.querySelector('[contenteditable]')||document.body).dispatchEvent(ev);
        }
        true;
      })();
    `;
    try { richRef.current?.injectJavascript?.(js); } catch (e) {}
    setImgSelected(false);
  };

  const toggleBold = () => {
    const js = `
      (function(){
        if (window.__restoreRange) window.__restoreRange();
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return true;
        var range = sel.getRangeAt(0);

        // 선택 영역이 있으면 그 부분만 토글
        if (!range.collapsed) {
          document.execCommand('bold');
        } else {
          // caret 위치가 <b>/<strong> 안인지 확인
          var node = range.startContainer;
          var inBold = false;
          var n = node;
          while (n && n.nodeType !== 1) n = n.parentNode;
          while (n) {
            if (n.nodeName === 'B' || n.nodeName === 'STRONG') { inBold = true; break; }
            if (n.getAttribute && n.getAttribute('contenteditable') === 'true') break;
            n = n.parentNode;
          }
          if (!inBold) {
            // 볼드 켜기: 빈 <b>\u200B</b> 삽입, caret을 ZWSP 뒤에 둠
            var b = document.createElement('b');
            b.appendChild(document.createTextNode('\u200B'));
            range.insertNode(b);
            var r = document.createRange();
            r.setStart(b.firstChild, 1);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
          } else {
            // 볼드 끄기: 가장 가까운 <b> 뒤로 caret 이동 + ZWSP 삽입
            var bAncestor = node;
            while (bAncestor && bAncestor.nodeName !== 'B' && bAncestor.nodeName !== 'STRONG') bAncestor = bAncestor.parentNode;
            if (bAncestor && bAncestor.parentNode) {
              var zwsp = document.createTextNode('\u200B');
              if (bAncestor.nextSibling) bAncestor.parentNode.insertBefore(zwsp, bAncestor.nextSibling);
              else bAncestor.parentNode.appendChild(zwsp);
              var r2 = document.createRange();
              r2.setStart(zwsp, 1);
              r2.collapse(true);
              sel.removeAllRanges();
              sel.addRange(r2);
            }
          }
        }
        var ev = document.createEvent('Event');
        ev.initEvent('input', true, true);
        (document.querySelector('[contenteditable]')||document.body).dispatchEvent(ev);
        try {
          if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'FMT_STATE', data:{bold:document.queryCommandState('bold'), h2:false}}));
        } catch(e) {}
        true;
      })();
    `;
    try { richRef.current?.injectJavascript?.(js); } catch (e) {}
    setBoldActive(v => !v);
  };

  const toggleHeading2 = () => {
    const js = `
      (function(){
        if (window.__restoreRange) window.__restoreRange();
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return true;
        var node = sel.anchorNode;
        while (node && node.nodeType !== 1) node = node.parentNode;
        var block = node;
        while (block && !/^(H1|H2|H3|P|DIV)$/.test(block.nodeName)) block = block.parentNode;
        var nowH2 = block && block.nodeName === 'H2';
        document.execCommand('formatBlock', false, nowH2 ? 'P' : 'H2');
        var ev = document.createEvent('Event');
        ev.initEvent('input', true, true);
        (document.querySelector('[contenteditable]')||document.body).dispatchEvent(ev);
        try {
          if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'FMT_STATE', data:{bold:document.queryCommandState('bold'), h2:!nowH2}}));
        } catch(e) {}
        true;
      })();
    `;
    try { richRef.current?.injectJavascript?.(js); } catch (e) {}
    setH2Active(v => !v);
  };

  const cancelImageSelect = () => {
    const js = `
      (function(){
        if (window.__selectedImg) {
          window.__selectedImg.style.outline = '';
          window.__selectedImg.style.outlineOffset = '';
          window.__selectedImg = null;
        }
        true;
      })();
    `;
    try { richRef.current?.injectJavascript?.(js); } catch (e) {}
    setImgSelected(false);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    // 에디터에서 직접 최신 HTML 가져오기 (onChange 미반영 방지)
    let latestHtml = currentHtml.current;
    try {
      const fetched = await richRef.current?.getContentHtml?.();
      if (typeof fetched === 'string') latestHtml = fetched;
    } catch (e) {}
    const html = normalizeHtmlForSave(latestHtml);
    const stripped = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
    const hasText = stripped.length > 0 || /<img/i.test(html);

    if (!trimmedTitle) { Alert.alert(t('post.notice'), t('post.titleRequired')); return; }
    if (!hasText) { Alert.alert(t('post.notice'), t('post.contentRequired')); return; }

    setSubmitting(true);
    try {
      const token = await getToken();
      const body = JSON.stringify(
        isGroupPost
          ? { groupId, title: trimmedTitle, content: html }
          : {
              boardId,
              title: trimmedTitle,
              content: html,
              isAnonymous: isAnonymousBoard,
              ...(isLocalBoard ? { city: selectedCity || '' } : {}),
            }
      );
      const url = isEditMode ? `${BASE_URL}/posts/${editPost.id}` : `${BASE_URL}/posts`;
      const res = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body,
      });
      const data = await res.json();
      if (data.success) {
        // 게시 성공 시 사용된 드래프트는 정리
        if (currentDraftId) { try { await deleteDraft(currentDraftId); } catch {} }
        navigation.goBack();
      } else Alert.alert(t('common.error'), data.message || t('post.requestFailed'));
    } catch (e) {
      Alert.alert(t('common.error'), t('post.requestFailedRetry'));
    } finally {
      setSubmitting(false);
    }
  };

  const hasContent = title.trim() && hasBody;

  // edgeToEdgeEnabled:true 인 Android에선 키보드 올라오면 insets.bottom이 자동으로
  // 키보드 높이를 반영함 (RN 0.74+). 따라서 kbHeight와 insets.bottom 중 큰 값만 쓰면
  // 키보드 다운 시엔 nav bar 버퍼, 키보드 업 시엔 키보드 높이만큼 정확히 padding됨.
  const keyboardPad = Math.max(kbHeight, insets.bottom);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === 'ios' ? 6 : insets.top,
          paddingBottom: keyboardPad,
        },
      ]}
    >
      {/* ── 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.topBarSide, { alignItems: 'flex-start' }]}
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{isEditMode ? t('post.editTitle') : t('post.writeTitle')}</Text>
        <View style={[styles.topBarSide, { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', minWidth: 150 }]}>
          {draftsEnabled && (
            <>
              <TouchableOpacity
                onPress={() => setDraftsModalOpen(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.draftBtn}
                accessibilityRole="button"
                accessibilityLabel={t('draft.openList')}
              >
                <Ionicons name="menu" size={22} color={colors.text} />
                {drafts.length > 0 && (
                  <View style={styles.draftBadge}>
                    <Text style={styles.draftBadgeText}>{drafts.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSaveDraft}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.draftSaveBtn}
                accessibilityRole="button"
                accessibilityLabel={t('draft.save')}
              >
                <Text style={styles.draftSaveText}>{t('draft.save')}</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!hasContent || submitting}
            activeOpacity={0.85}
            style={[styles.postBtn, !hasContent && styles.postBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.postBtnText}>{isEditMode ? t('post.editDone') : t('post.submitBtn')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 게시판 + 도시 선택 (작성/수정 모두) */}
      {(boardName || groupName) && (
        <View style={styles.boardRow}>
          <View style={styles.boardSelect}>
            <Text style={styles.boardSelectText}>
              {isGroupPost ? `👥 ${groupName}` : boardName}
            </Text>
          </View>
          {isLocalBoard && !isGroupPost && (
            <TouchableOpacity style={styles.citySelect} onPress={() => setCityModalOpen(true)} activeOpacity={0.7}>
              <Ionicons name="location" size={14} color={selectedCity ? colors.primary : colors.textSecondary} />
              <Text style={[styles.citySelectText, selectedCity && { color: colors.primary }]}>
                {selectedCity ? t(`city.${selectedCity}`) : t('home.regionAll')}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 도시 선택 모달 */}
      <Modal visible={cityModalOpen} transparent animationType="slide" onRequestClose={() => setCityModalOpen(false)}>
        <TouchableOpacity style={styles.cityModalOverlay} activeOpacity={1} onPress={() => setCityModalOpen(false)}>
          <View style={styles.cityModalBox}>
            <Text style={styles.cityModalTitle}>{t('home.regionFilter')}</Text>
            <FlatList
              data={['', ...CITIES]}
              keyExtractor={c => c || '__all__'}
              style={{ maxHeight: 400 }}
              renderItem={({ item: city }) => (
                <TouchableOpacity
                  style={[styles.cityRow, selectedCity === city && styles.cityRowActive]}
                  onPress={() => { setSelectedCity(city); setCityModalOpen(false); }}
                >
                  {city === '' ? (
                    <Ionicons name="globe-outline" size={16} color={!selectedCity ? colors.primary : colors.textSecondary} />
                  ) : null}
                  <Text style={[styles.cityRowText, selectedCity === city && styles.cityRowTextActive]}>
                    {city ? t(`city.${city}`) : t('home.regionAll')}
                  </Text>
                  {selectedCity === city && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 임시저장 (드래프트) 목록 모달 */}
      <Modal
        visible={draftsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDraftsModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.cityModalOverlay}
          activeOpacity={1}
          onPress={() => setDraftsModalOpen(false)}
        >
          <View style={styles.draftSheet}>
            <View style={styles.draftHeader}>
              <Text style={styles.cityModalTitle}>{t('draft.title')}</Text>
              <Text style={styles.draftHeaderCount}>{drafts.length}</Text>
            </View>
            {drafts.length === 0 ? (
              <Text style={styles.draftEmpty}>{t('draft.empty')}</Text>
            ) : (
              <FlatList
                data={drafts}
                keyExtractor={(d) => String(d.id ?? d._id)}
                style={{ maxHeight: 420 }}
                ItemSeparatorComponent={() => <View style={styles.draftSep} />}
                renderItem={({ item }) => {
                  const id = item.id ?? item._id;
                  const preview = (item.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
                  return (
                    <TouchableOpacity
                      style={styles.draftRow}
                      onPress={() => onLoadDraft(item)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.draftRowTitle} numberOfLines={1}>
                          {item.title?.trim() || t('draft.untitled')}
                        </Text>
                        {!!preview && (
                          <Text style={styles.draftRowPreview} numberOfLines={1}>{preview}</Text>
                        )}
                        <Text style={styles.draftRowMeta}>
                          {new Date(item.updatedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          // iOS Modal + Alert.alert 조합이 slide 애니메이션 stale state 버그를 일으켜서
                          // 모달을 먼저 닫고 confirm 하는 게 안전 (시트가 사라지지 않음)
                          setDraftsModalOpen(false);
                          setTimeout(() => {
                            Alert.alert('', t('draft.deleteAsk'), [
                              { text: t('common.cancel'), style: 'cancel' },
                              { text: t('common.delete'), style: 'destructive', onPress: () => onDeleteDraft(id) },
                            ]);
                          }, 250);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.draftDelBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 제목 */}
      <TextInput
        ref={titleRef}
        style={styles.titleInput}
        placeholder={t('post.titlePh')}
        placeholderTextColor={colors.textSecondary}
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        returnKeyType="next"
        onFocus={() => setEditorFocused(false)}
        onSubmitEditing={() => {
          // 다음(↵) 키 → 본문 포커스 (제목→본문 매끄럽게)
          try { richRef.current?.focusContentEditor?.(); } catch {}
        }}
        blurOnSubmit={false}
      />

      <View style={styles.divider} />

      {/* 리치 에디터 — 외부 ScrollView가 스크롤 담당 (pell-rich-editor는 WebView 내부 스크롤 비활성) */}
      <ScrollView
        ref={scrollRef}
        style={styles.editorScroll}
        contentContainerStyle={styles.editorScrollContent}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        onLayout={(e) => { scrollViewHeightRef.current = e.nativeEvent.layout.height; }}
      >
        <RichEditor
          ref={richRef}
          initialContentHTML=""
          placeholder={t('post.contentPh')}
          scrollEnabled={true}
          onFocus={() => setEditorFocused(true)}
          onBlur={() => setEditorFocused(false)}
          onCursorPosition={(cursorY) => {
            // 커서가 화면 중간(1/2 지점)에 오도록 자동 스크롤
            const visibleH = scrollViewHeightRef.current || 400;
            if (visibleH <= 0) return;
            const targetY = Math.max(0, cursorY - visibleH / 2);
            scrollRef.current?.scrollTo({ y: targetY, animated: true });
          }}
          onMessage={handleEditorMessage}
          editorInitializedCallback={() => {
            // 이미지 탭 감지 → RN으로 메시지 전송 (선택된 이미지에 outline 표시)
            const imgSelectJS = `
              (function(){
                if (window.__imgSelBound) return true;
                window.__imgSelBound = true;
                window.__selectedImg = null;
                function clearSel(){
                  if (window.__selectedImg) {
                    window.__selectedImg.style.outline = '';
                    window.__selectedImg.style.outlineOffset = '';
                  }
                  window.__selectedImg = null;
                }
                document.addEventListener('click', function(e){
                  var t = e.target;
                  if (t && t.nodeName === 'IMG') {
                    e.preventDefault();
                    e.stopPropagation();
                    clearSel();
                    window.__selectedImg = t;
                    t.style.outline = '3px solid #007AFF';
                    t.style.outlineOffset = '2px';
                    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'IMG_SELECTED'}));
                  } else if (window.__selectedImg) {
                    clearSel();
                    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'IMG_DESELECTED'}));
                  }
                }, true);
                true;
              })();
            `;
            try { richRef.current?.injectJavascript?.(imgSelectJS); } catch(e) {}

            // selection 추적 + bold/h2 활성 상태 RN으로 전송
            const selTrackJS = `
              (function(){
                if (window.__selTrackBound) return true;
                window.__selTrackBound = true;
                window.__savedRange = null;
                function saveRange(){
                  var sel = window.getSelection();
                  if (sel && sel.rangeCount > 0) {
                    var r = sel.getRangeAt(0);
                    var ed = document.querySelector('[contenteditable]');
                    if (ed && ed.contains(r.startContainer)) window.__savedRange = r.cloneRange();
                  }
                }
                function reportState(){
                  try {
                    var bold = document.queryCommandState('bold');
                    var node = window.getSelection() && window.getSelection().anchorNode;
                    while (node && node.nodeType !== 1) node = node.parentNode;
                    var isH2 = false;
                    var n = node;
                    while (n) { if (n.nodeName === 'H2') { isH2 = true; break; } n = n.parentNode; }
                    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'FMT_STATE', data:{bold:bold, h2:isH2}}));
                  } catch(e) {}
                }
                document.addEventListener('selectionchange', function(){ saveRange(); reportState(); });
                document.addEventListener('keyup', reportState);
                document.addEventListener('mouseup', reportState);
                window.__restoreRange = function(){
                  var ed = document.querySelector('[contenteditable]');
                  if (ed) ed.focus();
                  if (window.__savedRange) {
                    var sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(window.__savedRange);
                  }
                };
                true;
              })();
            `;
            try { richRef.current?.injectJavascript?.(selTrackJS); } catch(e) {}

            // 사진 위/사이에 "─ 글 추가 ─" 힌트 자동 삽입
            const hintJS = `
              (function(){
                // pell-rich-editor는 상황에 따라 P 또는 DIV로 감쌈 → 둘 다 블록으로 인식
                function isBlock(el){
                  return !!el && (el.nodeName === 'P' || el.nodeName === 'DIV');
                }
                function isImgPara(el){
                  if (!isBlock(el)) return false;
                  var imgs = el.querySelectorAll('img');
                  if (imgs.length === 0) return false;
                  var txt = (el.textContent || '').replace(/[\\s\\u200b\\u200c\\u200d\\ufeff\\u00a0]+/g, '');
                  return txt.length === 0;
                }
                function isHint(el){
                  return el && el.dataset && el.dataset.addHint === '1';
                }
                function makeHint(){
                  var hint = document.createElement('p');
                  hint.setAttribute('data-add-hint','1');
                  hint.contentEditable = 'false';
                  hint.style.margin = '6px 0';
                  hint.style.cursor = 'pointer';
                  hint.style.userSelect = 'none';
                  hint.style.textAlign = 'center';
                  hint.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:#F2F2F4;color:#9A9AA2;font-size:12px;font-weight:600;line-height:1;">${t('post.addHint')}</span>';
                  hint.addEventListener('click', function(e){
                    e.preventDefault();
                    var blank = document.createElement('p');
                    blank.innerHTML = '<br>';
                    blank.setAttribute('data-fresh','1'); // 방금 생성됨 → 전역 리스너가 유저 입력 감지 시 0으로 전환
                    hint.parentNode.replaceChild(blank, hint);
                    var range = document.createRange();
                    range.setStart(blank, 0);
                    range.collapse(true);
                    var sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    blank.focus && blank.focus();
                    var ev = document.createEvent('Event');
                    ev.initEvent('input', true, true);
                    (document.querySelector('[contenteditable]')||document.body).dispatchEvent(ev);
                  });
                  return hint;
                }

                // 전역: 유저의 실제 입력(e.isTrusted)만 감지해서 fresh 블랭크를 0으로 전환
                // 합성 이벤트(programmatic dispatchEvent)는 무시 → 초기 생성 시점 오발동 없음
                function flipFreshIfUserTyped(e){
                  if (!e || e.isTrusted === false) return;
                  var sel = window.getSelection();
                  if (!sel || !sel.anchorNode) return;
                  var node = sel.anchorNode;
                  while (node) {
                    if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-fresh') === '1') {
                      node.setAttribute('data-fresh','0');
                      return;
                    }
                    node = node.parentNode;
                  }
                }
                if (!window.__freshFlipBound) {
                  window.__freshFlipBound = true;
                  document.addEventListener('input', flipFreshIfUserTyped, true);
                  document.addEventListener('keyup', flipFreshIfUserTyped, true);
                  document.addEventListener('compositionend', flipFreshIfUserTyped, true);
                }
                function isEmptyPara(el){
                  if (!isBlock(el)) return false;
                  if (isHint(el)) return false;
                  if (el.querySelectorAll('img').length > 0) return false;
                  // textContent + 모든 종류의 공백/제로폭 문자 제거 (iOS 대응)
                  var txt = (el.textContent || '').replace(/[\\s\\u200b\\u200c\\u200d\\ufeff\\u00a0]+/g, '');
                  return txt.length === 0;
                }
                function isCursorIn(el){
                  var sel = window.getSelection();
                  if (!sel || sel.rangeCount === 0) return false;
                  var node = sel.anchorNode;
                  while (node) { if (node === el) return true; node = node.parentNode; }
                  return false;
                }
                function decorate(){
                  var root = document.querySelector('[contenteditable]') || document.body;

                  // 1) stale 힌트 제거 (TOP: next가 이미지, MIDDLE: prev/next 모두 이미지)
                  var hints = document.querySelectorAll('[data-add-hint="1"]');
                  hints.forEach(function(h){
                    var prev = h.previousElementSibling;
                    var next = h.nextElementSibling;
                    var isTop = !prev && isImgPara(next);
                    var isMid = isImgPara(prev) && isImgPara(next);
                    if (!isTop && !isMid) {
                      h.parentNode && h.parentNode.removeChild(h);
                    }
                  });

                  // fresh='1' 인 빈 문단은 방금 힌트 클릭으로 만들어진 것 → 건드리지 않음
                  // fresh='0' 또는 속성 없음 → 유저가 타이핑하다 비웠거나 기존 빈 문단 → 힌트로 교체 가능
                  function canReplace(el){
                    return isEmptyPara(el) && el.getAttribute('data-fresh') !== '1';
                  }

                  // 2) TOP 슬롯
                  var first = root.firstElementChild;
                  if (first && isImgPara(first)) {
                    root.insertBefore(makeHint(), first);
                  } else if (first && canReplace(first)) {
                    var second = first.nextElementSibling;
                    if (isImgPara(second)) {
                      first.parentNode.replaceChild(makeHint(), first);
                    }
                  }

                  // 3) MIDDLE 슬롯
                  var ps = Array.prototype.slice.call(root.querySelectorAll('p'));
                  ps.forEach(function(p){
                    if (!isImgPara(p)) return;
                    var next = p.nextElementSibling;
                    if (!next) return;
                    if (isImgPara(next)) {
                      if (!isHint(next.previousElementSibling)) {
                        p.parentNode.insertBefore(makeHint(), next);
                      }
                    } else if (canReplace(next)) {
                      var after = next.nextElementSibling;
                      if (isImgPara(after)) {
                        next.parentNode.replaceChild(makeHint(), next);
                      }
                    }
                  });
                }
                // 전역 노출: 이미지 삽입 등 외부에서 명시적 호출 가능
                window.__decorateHints = decorate;
                decorate();
                // childList: 요소 추가/제거, characterData: 텍스트 변경 (글자 단위 삭제 감지)
                var decTimer = null;
                function schedule(){
                  clearTimeout(decTimer);
                  decTimer = setTimeout(decorate, 0);
                }
                var obs = new MutationObserver(schedule);
                obs.observe(document.body, { childList: true, subtree: true, characterData: true });
                document.addEventListener('selectionchange', function(){
                  clearTimeout(decTimer);
                  decTimer = setTimeout(decorate, 100);
                });
                document.addEventListener('input', function(e){
                  if (e.isTrusted === false) return;
                  schedule();
                }, true);
                document.addEventListener('keyup', function(e){
                  if (e.isTrusted === false) return;
                  schedule();
                }, true);

                // pell-rich-editor의 height 동기화 강화: scrollHeight 변화를 주기적으로 감지
                // 원인: 이미지 로드 과정에서 scrollHeight가 일시적으로 spike되면 state.height가 그 값에 고착 → 큰 빈공간
                var editable = document.querySelector('[contenteditable]');
                var lastHeight = 0;
                function syncHeight(){
                  if (!editable) editable = document.querySelector('[contenteditable]');
                  if (!editable) return;
                  var h = editable.scrollHeight;
                  if (h !== lastHeight) {
                    lastHeight = h;
                    var ev = document.createEvent('Event');
                    ev.initEvent('input', true, true);
                    editable.dispatchEvent(ev);
                  }
                }
                // ResizeObserver로 내용 크기 변화 실시간 감지
                if (window.ResizeObserver && editable) {
                  try { new ResizeObserver(syncHeight).observe(editable); } catch(e) {}
                }
                // 폴링 보조 (ResizeObserver 없거나 놓친 경우)
                setInterval(function(){
                  decorate();
                  syncHeight();
                }, 500);
                true;
              })();
            `;
            try { richRef.current?.injectJavascript?.(hintJS); } catch(e) {}

            if (!initialHtmlRef.current) return;
            setTimeout(() => {
              try {
                richRef.current?.setContentHTML(initialHtmlRef.current);
                // 이미지 로드마다 height 재계산 + 힌트 decorate
                const reflowJS = `
                  (function(){
                    function onReady(){
                      var ev = document.createEvent('Event');
                      ev.initEvent('input', true, true);
                      (document.querySelector('[contenteditable]')||document.body).dispatchEvent(ev);
                      if (window.__decorateHints) window.__decorateHints();
                    }
                    // 콘텐츠 설정 직후 즉시 한 번 호출 (이미지 없거나 이미 캐시된 경우)
                    onReady();
                    var imgs = document.querySelectorAll('img');
                    imgs.forEach(function(img){
                      if (img.complete) {
                        onReady();
                      } else {
                        img.addEventListener('load', onReady);
                        img.addEventListener('error', onReady);
                      }
                    });
                    true;
                  })();
                `;
                setTimeout(() => {
                  try { richRef.current?.injectJavascript?.(reflowJS); } catch (e) {}
                }, 100);
              } catch (e) {}
            }, 50);
          }}
          onChange={handleChangeHtml}
          editorStyle={{
            backgroundColor: colors.surface,
            color: colors.text,
            placeholderColor: colors.textSecondary,
            contentCSSText: `
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              font-size: 16px;
              line-height: 1.6;
              padding: 12px 16px;
              font-weight: 400;
              color: ${colors.text};
              p { font-weight: 400; margin: 0 0 8px 0; }
              b, strong { font-weight: 800; }
              h1, h2, h3 { font-weight: 800; color: ${colors.text}; margin: 8px 0; }
              h2 { font-size: 20px; }
              img {
                display: block;
                margin: 14px auto;
                max-width: 100%;
                border-radius: 8px;
                -webkit-touch-callout: none;
                -webkit-user-drag: none;
              }
            `,
          }}
          initialHeight={140}
          useContainer
          defaultParagraphSeparator="p"
        />
      </ScrollView>

      {uploadingImage && (
        <View style={styles.uploadOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.uploadOverlayText}>{t('post.uploading')}</Text>
        </View>
      )}

      {/* ── 이미지 선택 시: 삭제/취소 액션바 (툴바 자리) */}
      {imgSelected ? (
        <View
          style={[
            styles.toolbar,
            styles.imgActionBar,
            { paddingBottom: kbHeight > 0 ? 4 : 8 },
          ]}
        >
          <TouchableOpacity onPress={cancelImageSelect} style={styles.imgActionBtn}>
            <Text style={[styles.imgActionText, { color: '#9A9AA2' }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteSelectedImage} style={styles.imgActionBtn}>
            <Text style={[styles.imgActionText, { color: '#FF3B30' }]}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      ) : editorFocused ? (
      /* ── 포맷 툴바 — 본문 에디터 포커스됐을 때만 노출 */
      <RichToolbar
        editor={richRef}
        actions={[
          actions.insertImage,
          'TOGGLE_BOLD',
          actions.setItalic,
          actions.setUnderline,
          'TOGGLE_H2',
          actions.alignLeft,
          actions.alignCenter,
          actions.alignRight,
          actions.undo,
          actions.redo,
        ]}
        onPressAddImage={handlePickImage}
        TOGGLE_H2={toggleHeading2}
        TOGGLE_BOLD={toggleBold}
        iconMap={{
          [actions.insertImage]: () => (
            <Ionicons name="image-outline" size={22} color={colors.text} />
          ),
          TOGGLE_H2: ({ tintColor }) => (
            <Text style={{ color: h2Active ? colors.primary : tintColor, fontWeight: '800', fontSize: 16 }}>H</Text>
          ),
          TOGGLE_BOLD: ({ tintColor }) => (
            <Text style={{ color: boldActive ? colors.primary : tintColor, fontWeight: '900', fontSize: 16 }}>B</Text>
          ),
        }}
        iconTint={colors.text}
        selectedIconTint={colors.primary}
        style={[
          styles.toolbar,
          {
            paddingBottom: kbHeight > 0 ? 4 : 8,
          },
        ]}
      />
      ) : null}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  editorScroll: { flex: 1 },
  editorScrollContent: { paddingBottom: 16 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
  },
  topBarSide: { minWidth: 70, alignItems: 'flex-end', justifyContent: 'center' },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  postBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnDisabled: { opacity: 0.35 },
  postBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  draftBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.inputBg,
  },
  draftBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.surface,
  },
  draftBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  draftSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  draftSaveText: { fontSize: 13, fontWeight: '700', color: colors.text },
  draftSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingTop: 14, paddingBottom: 24, paddingHorizontal: 0,
  },
  draftHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, marginBottom: 8,
  },
  draftHeaderCount: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: colors.inputBg, borderRadius: 8,
    overflow: 'hidden',
  },
  draftEmpty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 40, fontSize: 13 },
  draftSep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  draftRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  draftRowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  draftRowPreview: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  draftRowMeta: { fontSize: 10, color: colors.textSecondary, marginTop: 3 },
  draftDelBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEE2E2', borderRadius: 8,
  },

  boardRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6,
  },
  boardSelect: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  boardSelectText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  citySelect: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.inputBg, borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  citySelectText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  // 도시 모달
  cityModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  cityModalBox: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, maxHeight: '60%',
  },
  cityModalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
  cityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8,
  },
  cityRowActive: { backgroundColor: colors.primary + '10' },
  cityRowText: { flex: 1, fontSize: 14, color: colors.text },
  cityRowTextActive: { color: colors.primary, fontWeight: '700' },

  titleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 10,
    letterSpacing: -0.2,
  },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16, marginVertical: 2 },

  uploadOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  uploadOverlayText: { color: '#fff', marginTop: 12, fontSize: 14, fontWeight: '600' },

  toolbar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  imgActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  imgActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  imgActionText: { fontSize: 15, fontWeight: '700' },
});
