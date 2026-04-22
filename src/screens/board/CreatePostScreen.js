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
import { uploadPostImage } from '../../lib/api';
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
  // 이미지 액션바(혹시라도 직렬화되면) 제거
  out = out.replace(/<div[^>]*id=["']__imgActionBar["'][^>]*>[\s\S]*?<\/div>/gi, '');
  // 로컬 서버 URL만 상대 경로로 변환 (Cloudinary URL은 절대 URL 그대로 유지)
  const escaped = SERVER_HOST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  out = out.replace(new RegExp(`src=["']${escaped}(/uploads/[^"']+)["']`, 'g'), 'src="$1"');
  return out;
}

export default function CreatePostScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { boardId, boardSlug, boardName, editPost } = route.params ?? {};
  const isEditMode = !!editPost;
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();

  const isLocalBoard = LOCAL_BOARD_SLUGS.includes(boardSlug);
  const [selectedCity, setSelectedCity] = useState(user?.city || '');
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

  const initialHtmlRef = useRef(
    isEditMode ? contentToHtml(editPost.content ?? '') : ''
  );
  const currentHtml = useRef(initialHtmlRef.current);

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
        // 새 이미지 로드 후 리플로우 (1/4만 보이는 현상 방지)
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
      const body = JSON.stringify({
        boardId,
        title: trimmedTitle,
        content: html,
        isAnonymous: false,
        ...(isLocalBoard && selectedCity ? { city: selectedCity } : {}),
      });
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
      if (data.success) navigation.goBack();
      else Alert.alert(t('common.error'), data.message || t('post.requestFailed'));
    } catch (e) {
      Alert.alert(t('common.error'), t('post.requestFailedRetry'));
    } finally {
      setSubmitting(false);
    }
  };

  const hasContent = title.trim() && hasBody;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === 'ios' ? 6 : insets.top,
          paddingBottom: kbHeight > 0 ? kbHeight : 0,
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
        <View style={styles.topBarSide}>
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

      {/* 게시판 + 도시 선택 */}
      {!isEditMode && boardName && (
        <View style={styles.boardRow}>
          <View style={styles.boardSelect}>
            <Text style={styles.boardSelectText}>{boardName}</Text>
          </View>
          {isLocalBoard && (
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

      {/* 제목 */}
      <TextInput
        style={styles.titleInput}
        placeholder={t('post.titlePh')}
        placeholderTextColor={colors.textSecondary}
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        returnKeyType="next"
      />

      <View style={styles.divider} />

      {/* 리치 에디터 — 자체 WebView 스크롤 사용 */}
      <View style={styles.editorWrap}>
        <RichEditor
          ref={richRef}
          initialContentHTML=""
          placeholder={t('post.contentPh')}
          scrollEnabled={true}
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

            // 인접한 사진 사이에 "─ 글 추가 ─" 힌트 자동 삽입
            const hintJS = `
              (function(){
                function isImgPara(el){
                  if (!el || el.nodeName !== 'P') return false;
                  var imgs = el.querySelectorAll('img');
                  if (imgs.length === 0) return false;
                  var txt = (el.innerText || '').replace(/\\s/g,'');
                  return txt.length === 0;
                }
                function decorate(){
                  // 1) 더 이상 사진 사이가 아닌 stale 힌트 제거
                  var hints = document.querySelectorAll('[data-add-hint="1"]');
                  hints.forEach(function(h){
                    var prev = h.previousElementSibling;
                    var next = h.nextElementSibling;
                    if (!isImgPara(prev) || !isImgPara(next)) {
                      h.parentNode && h.parentNode.removeChild(h);
                    }
                  });
                  // 2) 인접 사진 사이에 힌트 추가
                  var ps = document.querySelectorAll('p');
                  ps.forEach(function(p){
                    if (!isImgPara(p)) return;
                    var next = p.nextElementSibling;
                    if (!next || !isImgPara(next)) return;
                    if (next.previousElementSibling && next.previousElementSibling.dataset && next.previousElementSibling.dataset.addHint === '1') return;
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
                    p.parentNode.insertBefore(hint, next);
                  });
                }
                decorate();
                var obs = new MutationObserver(function(){
                  // 무한 루프 방지: 자기 자신이 추가한 노드는 무시되도록 다음 틱에
                  setTimeout(decorate, 0);
                });
                obs.observe(document.body, { childList: true, subtree: true });
                true;
              })();
            `;
            try { richRef.current?.injectJavascript?.(hintJS); } catch(e) {}

            if (!initialHtmlRef.current) return;
            setTimeout(() => {
              try {
                richRef.current?.setContentHTML(initialHtmlRef.current);
                // 이미지 로드 후 강제 리플로우 (스페이스바 안 눌러도 전체 렌더되게)
                const reflowJS = `
                  (function(){
                    var imgs = document.querySelectorAll('img');
                    var done = 0, total = imgs.length;
                    function refresh(){
                      document.body.style.display='none';
                      void document.body.offsetHeight;
                      document.body.style.display='';
                      var ev = document.createEvent('Event');
                      ev.initEvent('input', true, true);
                      (document.querySelector('[contenteditable]')||document.body).dispatchEvent(ev);
                    }
                    if (total === 0) { refresh(); return true; }
                    imgs.forEach(function(img){
                      if (img.complete) { done++; if(done===total) refresh(); }
                      else {
                        img.addEventListener('load', function(){ done++; if(done===total) refresh(); });
                        img.addEventListener('error', function(){ done++; if(done===total) refresh(); });
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
              font-size: 16px;
              line-height: 1.6;
              padding: 12px 16px;
              min-height: 300px;
              font-weight: 400;
              color: ${colors.text};
              p { font-weight: 400; margin: 0 0 8px 0; }
              b, strong { font-weight: 800; }
              h1, h2, h3 { font-weight: 800; color: ${colors.text}; margin: 8px 0; }
              h2 { font-size: 20px; }
              img { display: block; margin: 14px auto; max-width: 100%; border-radius: 8px; }
            `,
          }}
          initialHeight={320}
          useContainer
        />
      </View>

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
            { paddingBottom: kbHeight > 0 ? 4 : insets.bottom + 8 },
          ]}
        >
          <TouchableOpacity onPress={cancelImageSelect} style={styles.imgActionBtn}>
            <Text style={[styles.imgActionText, { color: '#9A9AA2' }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteSelectedImage} style={styles.imgActionBtn}>
            <Text style={[styles.imgActionText, { color: '#FF3B30' }]}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
      /* ── 포맷 툴바 */
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
            paddingBottom: kbHeight > 0 ? 4 : insets.bottom + 8,
          },
        ]}
      />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  editorWrap: { flex: 1 },

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
