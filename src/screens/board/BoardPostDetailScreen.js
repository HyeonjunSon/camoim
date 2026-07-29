import { useState, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  ActionSheetIOS,
  Share,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomHeader from '../../components/CustomHeader';
import RenderHTML from 'react-native-render-html';

const isHtmlContent = (s) => typeof s === 'string' && /<\w+/.test(s);
function absolutizeHtml(html) {
  if (!html) return '';
  let out = html;
  // 과거 주입으로 박힌 ✕ 버튼/래퍼 제거
  out = out.replace(/<span[^>]*data-img-del[^>]*>[\s\S]*?<\/span>/gi, '');
  out = out.replace(/<span[^>]*data-img-wrap[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  return out.replace(/src=["'](\/uploads\/[^"']+)["']/g, (m, p) => `src="${require('../../lib/config').SERVER_HOST}${p}"`);
}
const buildHtmlTagsStyles = (colors) => ({
  body: { color: colors.text, fontSize: 15, lineHeight: 24 },
  p: { marginTop: 0, marginBottom: 8, color: colors.text },
  h1: { fontSize: 21, fontWeight: '800', color: colors.text, marginTop: 6, marginBottom: 6 },
  h2: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 6, marginBottom: 6 },
  h3: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 4, marginBottom: 4 },
  strong: { fontWeight: '800' },
  b: { fontWeight: '800' },
  em: { fontStyle: 'italic' },
  u: { textDecorationLine: 'underline' },
  img: { borderRadius: 12, marginVertical: 10 },
  a: { color: colors.primary },
});

import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { getPost, getComments, addComment, reportPost, pinComment, deleteComment, editComment, likePost, deletePost, bookmarkPost, pinPost, setBlock, setTradeStatus } from '../../lib/api';
import { track } from '../../lib/analytics';
import { isTradeBoard, getTradeLabel, getTradeChangeLabel } from '../../constants/boards';
import { formatTime } from '../../lib/time';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { getBoardName } from '../../lib/i18n';
import Avatar from '../../components/common/Avatar';
import RoleBadge from '../../components/RoleBadge';
import ImageGalleryModal from '../../components/ImageGalleryModal';

import { SERVER_HOST } from '../../lib/config';
const BASE_URL = SERVER_HOST;

function peelTextStyles(text) {
  let s = text;
  let bold = false, heading = false, align = 'left';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const m = s.match(/^\[([BHC])\]([\s\S]*)\[\/\1\]$/);
    if (!m) break;
    if (m[1] === 'B') bold = true;
    else if (m[1] === 'H') heading = true;
    else if (m[1] === 'C') align = 'center';
    s = m[2];
  }
  return { value: s, bold, heading, align };
}

// content 문자열 + images 배열 → 순서 보존된 블록 배열
function parseContentBlocks(content, images) {
  const pushText = (arr, raw) => {
    const trimmed = raw.replace(/^\n+|\n+$/g, '');
    if (trimmed === '') return;
    arr.push({ type: 'text', ...peelTextStyles(trimmed) });
  };

  if (!images || images.length === 0) {
    const result = [];
    pushText(result, content || '');
    if (result.length === 0) result.push({ type: 'text', value: '', bold: false, heading: false, align: 'left' });
    return result;
  }
  const hasMarkers = /\[IMG:\d+\]/.test(content);
  if (!hasMarkers) {
    const result = [];
    if (content?.trim()) pushText(result, content);
    images.forEach(url => result.push({ type: 'image', uri: `${BASE_URL}${url}` }));
    return result;
  }
  const parts = content.split(/(\[IMG:\d+\])/);
  const result = [];
  for (const part of parts) {
    const match = part.match(/^\[IMG:(\d+)\]$/);
    if (match) {
      const idx = parseInt(match[1]);
      if (images[idx]) result.push({ type: 'image', uri: /^https?:\/\//.test(images[idx]) ? images[idx] : `${BASE_URL}${images[idx]}` });
    } else if (part !== '') {
      pushText(result, part);
    }
  }
  return result;
}

const REPORT_KEYS = ['spam', 'hate', 'illegal', 'adult', 'etc'];
const reportReasons = (t) => REPORT_KEYS.map(k => ({ key: k, label: t(`post.r_${k}`) }));

// 댓글 단건 컴포넌트
function CommentItem({ comment, isReply = false, onMore, onAvatarPress, onReply, editingId, editText, onEditChange, onEditSubmit, onEditCancel, t, styles }) {
  const isEditing = editingId === comment.id;

  // 잠금 댓글 (마스킹된 경우)
  if (comment.isSecretMasked) {
    return (
      <View style={[styles.commentItem, isReply && styles.replyItem, styles.secretMaskedItem]}>
        {isReply && <Text style={styles.replyIndicatorText}>└</Text>}
        <Ionicons name="lock-closed" size={13} color={colors.textSecondary} style={{ marginTop: 2 }} />
        <Text style={styles.secretMaskedText}>{t('post.secretMasked')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.commentItem, isReply && styles.replyItem, comment.isPinned && styles.pinnedItem]}>
      {isReply && <Text style={styles.replyIndicatorText}>└</Text>}
      <TouchableOpacity
        onPress={() => onAvatarPress?.(comment)}
        activeOpacity={comment.isAnonymous ? 1 : 0.7}
        disabled={comment.isAnonymous || !comment.userId}
      >
        <Avatar nickname={comment.nickname || t('common.anonymous')} uri={comment.isAnonymous ? null : comment.avatarUrl} size={isReply ? 28 : 34} showLetter />
      </TouchableOpacity>
      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <View style={styles.commentHeaderLeft}>
            <Text style={styles.commentNickname}>{comment.nickname || t('common.anonymous')}</Text>
            {comment.isSecret && <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />}
            {comment.isPinned && (
              <View style={styles.pinnedBadge}>
                <Text style={styles.pinnedBadgeText}>{t('post.pinned')}</Text>
              </View>
            )}
          </View>
          <View style={styles.commentHeaderRight}>
            <Text style={styles.commentTime}>
              {formatTime(comment.createdAt, t)}
              {comment.edited && ` · ${t('post.commentEdited') || '수정됨'}`}
            </Text>
            <TouchableOpacity onPress={() => onMore(comment, isReply)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        {isEditing ? (
          <View style={styles.editInputRow}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={onEditChange}
              autoFocus
              multiline
              maxLength={300}
            />
            <TouchableOpacity onPress={onEditSubmit} style={styles.editSaveBtn} activeOpacity={0.8}>
              <Text style={styles.editSaveText}>{t('common.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onEditCancel} activeOpacity={0.8} style={{ paddingHorizontal: 4 }}>
              <Text style={styles.editCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text selectable style={styles.commentContent}>{comment.content}</Text>
            {!isReply && onReply && (
              <TouchableOpacity
                onPress={() => onReply(comment)}
                activeOpacity={0.6}
                style={styles.replyActionBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="return-down-forward-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.replyActionText}>{t('post.replyTo')}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

export default function BoardPostDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const htmlTagsStyles = useMemo(() => buildHtmlTagsStyles(colors), [colors]);

  const { postId } = route.params ?? {};
  const { user } = useAuth();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const headerHeight = useHeaderHeight();
  const { width: winWidth } = useWindowDimensions();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSecret, setIsSecret] = useState(false);

  // 좋아요 상태
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);

  // 북마크 상태
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // 이미지 뷰어
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const allImageUris = useMemo(() => {
    if (!post) return [];
    const blocks = parseContentBlocks(post.content, post.images);
    return blocks.filter(b => b.type === 'image').map(b => b.uri);
  }, [post]);
  const openImageViewer = (uri) => {
    const idx = allImageUris.findIndex(u => u === uri);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerVisible(true);
    track('image_view', { postId: String(postId) });
  };

  const loadData = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const [postRes, commentsRes] = await Promise.all([
        getPost(postId),
        getComments(postId),
      ]);
      if (postRes.success) {
        setPost(postRes.data);
        setLiked(!!postRes.data.liked);
        setLikeCount(postRes.data.likeCount ?? 0);
        setBookmarked(!!postRes.data.bookmarked);
      }
      if (commentsRes.success) setComments(commentsRes.data ?? []);
    } catch (e) {}
    finally { setLoading(false); }
  }, [postId]);

  const handleToggleLike = useCallback(async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
    try {
      const res = await likePost(postId);
      if (res.success) {
        setLiked(res.data.liked);
        setLikeCount(res.data.likeCount);
      } else {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    } catch (e) {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      Alert.alert(t('common.error'), t('post.likeFailed'));
    } finally {
      setLikeBusy(false);
    }
  }, [likeBusy, liked, likeCount, postId]);

  const handleToggleBookmark = useCallback(async () => {
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    const prev = bookmarked;
    setBookmarked(!prev);
    try {
      const res = await bookmarkPost(postId);
      if (res.success) {
        setBookmarked(res.data.bookmarked);
      } else {
        setBookmarked(prev);
      }
    } catch {
      setBookmarked(prev);
    } finally {
      setBookmarkBusy(false);
    }
  }, [bookmarkBusy, bookmarked, postId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const refreshComments = async () => {
    const res = await getComments(postId);
    if (res.success) setComments(res.data ?? []);
  };

  // 답글 버튼
  const handleReply = (comment) => {
    setReplyTo({ id: comment.id, nickname: comment.nickname || t('common.anonymous') });
    inputRef.current?.focus();
  };

  // 답글 취소
  const cancelReply = () => {
    setReplyTo(null);
    setCommentText('');
  };

  // 댓글 고정
  const handlePin = async (comment) => {
    try {
      const res = await pinComment(postId, comment.id);
      if (res.success) refreshComments();
    } catch (e) {
      Alert.alert(t('common.error'), e.message ?? t('post.pinFailed'));
    }
  };

  // 댓글 전송
  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await addComment(postId, {
        content: commentText.trim(),
        parentId: replyTo?.id ?? null,
        isSecret,
      });
      if (res.success) {
        setCommentText('');
        setReplyTo(null);
        setIsSecret(false);
        refreshComments();
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('post.writeCommentFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const showReportSheet = () => {
    const reasons = reportReasons(t);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...reasons.map(r => r.label), t('common.cancel')], cancelButtonIndex: reasons.length, title: t('post.reportPick') },
        async (idx) => { if (idx < reasons.length) await submitReport(reasons[idx].key); }
      );
    } else {
      Alert.alert(t('post.reportTitle'), t('post.reportPick'), [
        ...reasons.map(r => ({ text: r.label, onPress: () => submitReport(r.key) })),
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  };

  const submitReport = async (reason) => {
    try {
      const res = await reportPost({ targetType: 'post', targetId: postId, reason });
      if (res.success) Alert.alert(t('post.reportDone'), res.data.message);
      else Alert.alert(t('common.error'), res.message ?? t('post.reportFailed'));
    } catch (e) {
      Alert.alert(t('common.error'), e.message ?? t('post.reportDup'));
    }
  };

  const isPostAuthor = post && user && String(post.userId) === String(user.id);

  const handleAvatarPress = (comment) => {
    if (comment.isAnonymous || !comment.userId) return;
    if (user && String(comment.userId) === String(user.id)) {
      navigation.navigate('MyPage');
    } else {
      navigation.push('UserProfile', { userId: comment.userId });
    }
  };

  const handleCommentMore = (comment, isReply) => {
    const isOwn = user && String(comment.userId) === String(user.id);
    const L = {
      reply: t('post.reply'), copy: t('post.copy'), edit: t('common.edit'),
      del: t('common.delete'), pin: t('post.pinned'), unpin: t('post.unpin'),
      cancel: t('common.cancel'),
    };
    const opts = [];
    if (!isReply) opts.push(L.reply);
    opts.push(L.copy);
    if (isOwn) { opts.push(L.edit); opts.push(L.del); }
    if (isPostAuthor && !isReply) opts.push(comment.isPinned ? L.unpin : L.pin);
    opts.push(L.cancel);
    const cancelIdx = opts.length - 1;

    const handle = async (idx) => {
      const action = opts[idx];
      if (action === L.reply) handleReply(comment);
      else if (action === L.copy) Share.share({ message: comment.content });
      else if (action === L.edit) { setEditingCommentId(comment.id); setEditingText(comment.content); }
      else if (action === L.del) {
        try {
          await deleteComment(postId, comment.id);
          refreshComments();
        } catch (e) {
          Alert.alert(t('common.error'), e.message ?? t('post.deleteFailed'));
        }
      } else if (action === L.pin || action === L.unpin) handlePin(comment);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: cancelIdx, destructiveButtonIndex: opts.indexOf(L.del), title: t('post.moreActions') },
        handle
      );
    } else {
      Alert.alert(t('post.moreActions'), '', opts.filter(o => o !== L.cancel).map(o => ({
        text: o, style: o === L.del ? 'destructive' : 'default',
        onPress: () => handle(opts.indexOf(o)),
      })).concat([{ text: L.cancel, style: 'cancel' }]));
    }
  };

  const handleEditCommentSave = async (comment) => {
    if (!editingText.trim()) return;
    const res = await editComment(postId, comment.id, editingText.trim());
    if (res.success) { setEditingCommentId(null); refreshComments(); }
    else Alert.alert(t('common.error'), t('post.editFailed'));
  };

  const confirmDeletePost = () => {
    Alert.alert(t('common.delete'), t('post.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deletePost(post.id);
            if (res.success) navigation.goBack();
            else Alert.alert(t('common.error'), res.message ?? t('post.deleteFailed'));
          } catch (e) {
            Alert.alert(t('common.error'), e.message ?? t('post.deleteFailed'));
          }
        },
      },
    ]);
  };

  // 모임 글 + 그룹장/부그룹장이면 모더레이션 권한 추가
  // 단, 작성자 본인일 땐 본인 글에 대해서는 글 수정/삭제만 가능 (고정은 모더레이션 행동)
  const isGroupMod = post?.myGroupRole === 'owner' || post?.myGroupRole === 'manager';
  const canDelete = isPostAuthor || isGroupMod;
  const canPin = !!post?.groupId && isGroupMod && !isPostAuthor;

  const togglePin = async () => {
    try {
      const next = !post.pinned;
      const res = await pinPost(post.id, next);
      if (res.success) setPost(prev => ({ ...prev, pinned: next }));
      else Alert.alert(t('common.error'), res.message ?? t('post.pinFailed'));
    } catch (e) {
      Alert.alert(t('common.error'), e.message ?? t('post.pinFailed'));
    }
  };

  // 거래 상태 토글 — 작성자 전용 (마켓 류 게시판에서만)
  const showTradeButton = isPostAuthor && isTradeBoard(post?.boardSlug);
  const isSold = post?.tradeStatus === 'sold';
  const toggleTradeStatus = async () => {
    const next = isSold ? 'selling' : 'sold';
    // Optimistic
    setPost(prev => ({ ...prev, tradeStatus: next }));
    try {
      const res = await setTradeStatus(post.id, next);
      if (!res.success) {
        setPost(prev => ({ ...prev, tradeStatus: isSold ? 'sold' : 'selling' }));
        Alert.alert(t('common.error'), res.message ?? t('common.serverError'));
      }
    } catch (e) {
      setPost(prev => ({ ...prev, tradeStatus: isSold ? 'sold' : 'selling' }));
      Alert.alert(t('common.error'), e.message ?? t('common.serverError'));
    }
  };

  // 토글 전 확인 다이얼로그 — 실수 방지
  const confirmToggleTradeStatus = () => {
    const next = isSold ? 'selling' : 'sold';
    const nextLabel = getTradeLabel(post.boardSlug, next, t);
    Alert.alert(
      t('board.tradeChangeConfirm').replace('{label}', nextLabel),
      '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm') || '변경', onPress: toggleTradeStatus, style: 'default' },
      ],
    );
  };

  // 작성자 차단 (익명 글이거나 본인 글이면 비활성)
  const canBlockAuthor = !post?.isAnonymous && !!post?.userId && !isPostAuthor;
  const confirmBlockAuthor = () => {
    if (!canBlockAuthor) return;
    const nick = post.nickname || '이 사용자';
    Alert.alert(
      `${nick}님을 차단할까요?`,
      '차단하면 이 사용자의 글과 채팅이 더 이상 보이지 않아요.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: '차단',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await setBlock(post.userId, { blockChat: true, hideContent: true });
              if (res.success) {
                Alert.alert('', '차단되었어요.', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert(t('common.error'), res.message ?? t('common.serverError'));
              }
            } catch (e) {
              Alert.alert(t('common.error'), e.message ?? t('common.serverError'));
            }
          },
        },
      ]
    );
  };

  const handleSharePost = async () => {
    try {
      const preview = (post.content || '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim()
        .slice(0, 120);
      const lines = [`[${post.boardName || 'CaMoim'}] ${post.title || ''}`];
      if (preview) lines.push('', preview + (post.content && post.content.length > 120 ? '…' : ''));
      lines.push('', t('post.shareFooter'));
      await Share.share({ message: lines.join('\n'), title: post.title });
      track('post_share', { postId: String(postId), source: 'board', boardSlug: post.boardSlug });
    } catch {}
  };

  const handleMore = () => {
    const L = {
      share: t('post.sharePost'),
      edit: t('post.editPostMenu'),
      pin: '고정',
      unpin: '고정 해제',
      del: t('common.delete'),
      report: t('common.report'),
      block: '작성자 차단',
      cancel: t('common.cancel'),
    };
    // 옵션 동적 구성
    const opts = [L.share]; // 공유는 누구나
    if (isPostAuthor) opts.push(L.edit);
    if (canPin) opts.push(post.pinned ? L.unpin : L.pin);
    if (canDelete) opts.push(L.del);
    if (!isPostAuthor) opts.push(L.report);     // 본인 글은 신고 불필요
    if (canBlockAuthor) opts.push(L.block);     // 익명/본인 아닌 경우만
    opts.push(L.cancel);
    const cancelIdx = opts.length - 1;
    const delIdx = opts.indexOf(L.del);

    const handle = (idx) => {
      const action = opts[idx];
      if (action === L.share) handleSharePost();
      else if (action === L.edit) navigation.navigate('EditPost', { editPost: post });
      else if (action === L.pin || action === L.unpin) togglePin();
      else if (action === L.del) confirmDeletePost();
      else if (action === L.report) showReportSheet();
      else if (action === L.block) confirmBlockAuthor();
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: cancelIdx, destructiveButtonIndex: delIdx >= 0 ? delIdx : undefined, title: t('post.moreActions') },
        handle
      );
      return;
    }
    // Android fallback
    Alert.alert(t('post.moreActions'), '', opts.filter(o => o !== L.cancel).map(o => ({
      text: o,
      style: o === L.del ? 'destructive' : 'default',
      onPress: () => handle(opts.indexOf(o)),
    })).concat([{ text: L.cancel, style: 'cancel' }]));
  };

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const totalCommentCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!post) return <View style={styles.loadingContainer}><Text style={styles.errorText}>{t('post.cantLoad')}</Text></View>;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <CustomHeader
        navigation={navigation}
        title={t('post.postTitle')}
        rightActions={[
          { icon: 'ellipsis-horizontal', onPress: handleMore, label: t('post.moreActions') },
        ]}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >

        {/* ── 게시글 카드 */}
        <View style={styles.postCard}>

          {/* 게시판 태그 (왼쪽) + 거래 상태 (오른쪽 끝) */}
          {(post.boardName || isTradeBoard(post.boardSlug)) && (
            <View style={styles.tagRow}>
              {post.boardName && (
                <Text style={styles.boardTag}>{getBoardName(post.boardSlug, post.boardName, t)}</Text>
              )}
              {isTradeBoard(post.boardSlug) && (
                showTradeButton ? (
                  <View style={[styles.tradeSegment, { marginLeft: 'auto' }]}>
                <TouchableOpacity
                  style={[styles.tradeSegOption, !isSold && styles.tradeSegOptionActive]}
                  onPress={isSold ? confirmToggleTradeStatus : undefined}
                  activeOpacity={isSold ? 0.6 : 1}
                  disabled={!isSold}
                  accessibilityRole="button"
                >
                  <Text style={[styles.tradeSegText, !isSold ? styles.tradeSegTextActiveSelling : styles.tradeSegTextInactive]}>
                    {getTradeLabel(post.boardSlug, 'selling', t)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tradeSegOption, isSold && styles.tradeSegOptionActive]}
                  onPress={!isSold ? confirmToggleTradeStatus : undefined}
                  activeOpacity={!isSold ? 0.6 : 1}
                  disabled={isSold}
                  accessibilityRole="button"
                >
                  <Text style={[styles.tradeSegText, isSold ? styles.tradeSegTextActiveSold : styles.tradeSegTextInactive]}>
                    {getTradeLabel(post.boardSlug, 'sold', t)}
                  </Text>
                </TouchableOpacity>
              </View>
                ) : (
                  <View style={[styles.tradeStatusPill, isSold ? styles.tradeStatusPillSold : styles.tradeStatusPillSelling, { marginLeft: 'auto' }]}>
                    <View style={[styles.tradeDot, isSold ? styles.tradeDotSold : styles.tradeDotSelling]} />
                    <Text style={[styles.tradeStatusPillText, isSold ? styles.tradeStatusPillTextSold : styles.tradeStatusPillTextSelling]}>
                      {getTradeLabel(post.boardSlug, isSold ? 'sold' : 'selling', t)}
                    </Text>
                  </View>
                )
              )}
            </View>
          )}

          {/* 제목 */}
          <Text selectable style={[styles.title, isSold && { color: colors.textSecondary }]}>{post.title}</Text>

          {/* 작성자 행 */}
          <TouchableOpacity
            style={styles.authorRow}
            activeOpacity={post.isAnonymous ? 1 : 0.7}
            onPress={() => {
              if (!post.isAnonymous && post.userId) {
                navigation.push('UserProfile', { userId: post.userId });
              }
            }}
          >
            <Avatar nickname={post.nickname || t('common.anonymous')} uri={post.isAnonymous ? null : post.avatarUrl} size={40} showLetter />
            <View style={styles.authorInfo}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName}>{post.nickname || t('common.anonymous')}</Text>
                {post.authorIsLeader && <Ionicons name="star" size={12} color={colors.primary} style={{ marginLeft: 2 }} />}
                {post.role ? <RoleBadge role={post.role} size="small" /> : null}
              </View>
              <View style={styles.authorMeta}>
                <Text style={styles.metaText}>{formatTime(post.createdAt, t)}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{t('post.views')} {post.viewCount ?? 0}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.sectionDivider} />

          {/* 본문: HTML(리치 에디터) 또는 레거시 블록 */}
          {isHtmlContent(post.content) ? (
            <View>
              <RenderHTML
                contentWidth={winWidth - 40}
                source={{ html: absolutizeHtml(post.content) }}
                tagsStyles={htmlTagsStyles}
                defaultTextProps={{ selectable: true, allowFontScaling: false }}
                renderersProps={{ img: { initialDimensions: { width: winWidth - 40, height: 220 } } }}
                enableExperimentalBRCollapsing
              />
            </View>
          ) : (
            parseContentBlocks(post.content, post.images).map((block, idx) =>
              block.type === 'image' ? (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.9}
                  onPress={() => openImageViewer(block.uri)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="이미지 크게 보기"
                >
                  <Image
                    source={{ uri: block.uri }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ) : (
                <Text
                  key={idx}
                  selectable
                  style={[
                    styles.content,
                    block.heading && styles.contentHeading,
                    block.bold && styles.contentBold,
                    block.align === 'center' && styles.contentCenter,
                  ]}
                >
                  {block.value}
                </Text>
              )
            )
          )}

        </View>

        {/* 본문이 짧을 때 scrap/like/댓글을 화면 하단으로 밀기 위한 flex spacer */}
        <View style={styles.bottomSpacer} />

        {/* ── 스크랩 / 좋아요 큰 버튼 */}
        <View style={styles.likeBigWrap}>
          <TouchableOpacity
            style={[styles.likeBigBtn, bookmarked && styles.bookmarkBigBtnActive]}
            onPress={handleToggleBookmark}
            activeOpacity={0.85}
            disabled={bookmarkBusy}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={bookmarked ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.likeBigText, bookmarked && styles.bookmarkBigTextActive]}>
              {t('post.bookmarkBtn')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.likeBigBtn, liked && styles.likeBigBtnActive]}
            onPress={handleToggleLike}
            activeOpacity={0.85}
            disabled={likeBusy}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? '#FF3B6B' : colors.textSecondary}
            />
            <Text style={[styles.likeBigText, liked && styles.likeBigTextActive]}>
              {t('post.likeBtn')} {likeCount}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 댓글 섹션 */}
        <View style={styles.commentSection}>
          <Text style={styles.commentCount}>{t('post.commentCount')} {totalCommentCount}{t('post.commentCountSuffix')}</Text>

          {comments.length === 0 ? (
            <Text style={styles.noCommentText}>{t('post.firstComment')}</Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id}>
                <CommentItem
                  comment={comment}
                  t={t}
                  styles={styles}
                  onMore={handleCommentMore}
                  onAvatarPress={handleAvatarPress}
                  onReply={handleReply}
                  editingId={editingCommentId}
                  editText={editingText}
                  onEditChange={setEditingText}
                  onEditSubmit={() => handleEditCommentSave(comment)}
                  onEditCancel={() => setEditingCommentId(null)}
                />
                {(comment.replies ?? []).map(reply => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    t={t}
                    styles={styles}
                    isReply
                    onMore={handleCommentMore}
                    editingId={editingCommentId}
                    editText={editingText}
                    onEditChange={setEditingText}
                    onEditSubmit={() => handleEditCommentSave(reply)}
                    onEditCancel={() => setEditingCommentId(null)}
                  />
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 답글 대상 표시 */}
      {replyTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>↩ <Text style={styles.replyBannerNick}>{replyTo.nickname}</Text>{t('post.replyTo2')}</Text>
          <TouchableOpacity onPress={cancelReply} activeOpacity={0.7}>
            <Text style={styles.replyBannerCancel}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── 바텀 바 */}
      <View style={styles.bottomBar}>
        <View style={styles.barInputWrap}>
          {/* 잠금 댓글 토글 */}
          <TouchableOpacity
            style={[styles.barLockBtn, isSecret && styles.barLockBtnActive]}
            onPress={() => setIsSecret(v => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSecret ? 'lock-closed' : 'lock-open-outline'}
              size={18}
              color={isSecret ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>

          <View style={styles.barSep} />

          <TextInput
            ref={inputRef}
            style={[styles.barInput, isSecret && styles.barInputSecret]}
            placeholder={
              replyTo
                ? `${replyTo.nickname}${t('post.replyToPlaceholder')}`
                : (isSecret ? t('post.secretCommentPlaceholder') : t('post.commentPlaceholder'))
            }
            placeholderTextColor={isSecret ? colors.primary + '90' : colors.textSecondary}
            value={commentText}
            onChangeText={setCommentText}
            returnKeyType="send"
            onSubmitEditing={handleSubmitComment}
            maxLength={300}
          />
        </View>

        <TouchableOpacity
          style={[styles.barSendBtn, !commentText.trim() && styles.barSendBtnInactive]}
          onPress={handleSubmitComment}
          disabled={submitting || !commentText.trim()}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.barSendText}>{t('common.send')}</Text>}
        </TouchableOpacity>
      </View>

      <ImageGalleryModal
        visible={viewerVisible}
        images={allImageUris}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}
// duplicate code removed

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 14, color: colors.danger },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  bottomSpacer: { flex: 1, backgroundColor: colors.surface },
  postCard: { backgroundColor: colors.surface, padding: 17 },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 13,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  // 거래 상태 칩 — 게시판 태그 옆 인라인
  tradeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tradeStatusPillSelling: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  tradeStatusPillSold: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border },
  tradeDot: { width: 6, height: 6, borderRadius: 3 },
  tradeDotSelling: { backgroundColor: '#10B981' },
  tradeDotSold: { backgroundColor: colors.textSecondary },
  tradeStatusPillText: { fontSize: 11, fontWeight: '800', letterSpacing: -0.2 },
  tradeStatusPillTextSelling: { color: '#047857' },
  tradeStatusPillTextSold: { color: colors.textSecondary },

  // 컴팩트 세그먼트 토글 — 작성자 전용
  // 풀너비 X, 콘텐츠 너비만큼만, 마진/패딩 작게
  tradeSegment: {
    flexDirection: 'row',
    backgroundColor: colors.inputBg,
    borderRadius: 7,
    padding: 2,
    alignSelf: 'flex-start',  // 콘텐츠 너비만큼만
  },
  tradeSegOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  tradeSegOptionActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
    elevation: 1,
  },
  tradeSegText: { fontSize: 12, fontWeight: '700', letterSpacing: -0.2 },
  tradeSegTextActiveSelling: { color: '#047857' },
  tradeSegTextActiveSold: { color: colors.text },
  tradeSegTextInactive: { color: colors.textSecondary },

  boardTag: {
    fontSize: 11, fontWeight: '700', color: colors.primary,
    backgroundColor: colors.primary + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  title: { fontSize: 21, fontWeight: '800', color: colors.text, lineHeight: 28 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 13 },
  authorInfo: { flex: 1 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontSize: 15, fontWeight: '700', color: colors.text },
  authorMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 11, color: colors.textSecondary },
  metaDot: { fontSize: 11, color: colors.textSecondary },
  contentDivider: { height: 0.5, backgroundColor: colors.border, marginVertical: 15 },
  content: { fontSize: 15, lineHeight: 24, color: colors.text },
  contentHeading: { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  contentBold: { fontWeight: '700' },
  contentCenter: { textAlign: 'center' },
  postImage: { width: '100%', height: 280, borderRadius: 12, marginVertical: 10, backgroundColor: colors.inputBg },
  likeBigWrap: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 10, paddingVertical: 16,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginBottom: 8,
  },
  likeBigBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24,
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
  },
  likeBigBtnActive: { backgroundColor: colors.danger + '12', borderColor: '#FFB3C6' },
  likeBigText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  likeBigTextActive: { color: '#FF3B6B' },
  bookmarkBigBtnActive: { backgroundColor: colors.primary + '12', borderColor: colors.primary + '60' },
  bookmarkBigTextActive: { color: colors.primary },
  commentSection: { backgroundColor: colors.background, padding: 16, paddingBottom: 8 },
  commentCount: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  noCommentText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
  commentItem: {
    flexDirection: 'row', gap: 10, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  replyItem: { paddingLeft: 20 },
  pinnedItem: { backgroundColor: colors.primary + '06', borderRadius: 8, paddingHorizontal: 8, marginHorizontal: -8 },
  secretMaskedItem: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  replyIndicatorText: { fontSize: 14, color: colors.textSecondary, marginRight: 4, marginTop: 2 },
  secretMaskedText: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentNickname: { fontSize: 13, fontWeight: '700', color: colors.text },
  commentTime: { fontSize: 11, color: colors.textSecondary },
  pinnedBadge: { backgroundColor: colors.primary + '15', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  pinnedBadgeText: { fontSize: 9, fontWeight: '700', color: colors.primary },
  commentContent: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 4 },
  replyActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start' },
  replyActionText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  editInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  editInput: {
    flex: 1, backgroundColor: colors.inputBg, borderRadius: 8, padding: 8,
    fontSize: 13, color: colors.text,
  },
  editSaveBtn: { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  editSaveText: { fontSize: 12, fontWeight: '700', color: colors.white },
  editCancelText: { fontSize: 12, color: colors.textSecondary },
  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary + '10', paddingHorizontal: 16, paddingVertical: 8,
  },
  replyBannerText: { fontSize: 13, color: colors.primary },
  replyBannerNick: { fontWeight: '700' },
  replyBannerCancel: { fontSize: 18, color: colors.textSecondary, paddingHorizontal: 8 },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surface,
    borderTopWidth: 0.5, borderTopColor: colors.border,
  },
  barInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.inputBg, borderRadius: 24, paddingHorizontal: 4, minHeight: 44,
  },
  barSep: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: colors.border, marginHorizontal: 2 },
  barLockBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 14 },
  barLockBtnActive: { backgroundColor: colors.primary + '15' },
  barInput: {
    flex: 1, paddingHorizontal: 10, paddingVertical: 10,
    fontSize: 15, color: colors.text, maxHeight: 100,
  },
  barInputSecret: { color: colors.primary },
  barSendBtn: {
    backgroundColor: colors.primary, borderRadius: 22, paddingHorizontal: 18,
    minHeight: 44, justifyContent: 'center', alignItems: 'center',
  },
  barSendBtnInactive: { backgroundColor: colors.primary + '55' },
  barSendText: { fontSize: 13, fontWeight: '700', color: colors.white },
  barIcon: { padding: 8 },

});
