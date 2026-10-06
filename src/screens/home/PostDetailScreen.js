import { useState, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { Text, TextInput } from '../../components/StyledText';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  ActionSheetIOS,
  Share,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import CustomHeader from '../../components/CustomHeader';
import ImageGalleryModal from '../../components/ImageGalleryModal';
import RenderHTML from 'react-native-render-html';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { getPost, getComments, addComment, reportPost, pinComment, deleteComment, editComment, likePost, deletePost, bookmarkPost, setBlock, setTradeStatus, getStayByPost } from '../../lib/api';
import { isTradeBoard, getTradeLabel } from '../../constants/boards';
import { track } from '../../lib/analytics';
import { formatTime } from '../../lib/time';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import Avatar from '../../components/common/Avatar';
import RoleBadge from '../../components/RoleBadge';

import { SERVER_HOST } from '../../lib/config';
const BASE_URL = SERVER_HOST;

// Strip the style markers ([B]/[H]/[C]) from a single text segment
function peelTextStyles(text) {
  let s = text;
  let bold = false, heading = false, align = 'left';
  // Repeats, in case several are nested
  // Only when [TAG]…[/TAG] wraps the paragraph exactly, start to end
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

// content string + images array → an ordered array of blocks
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
    // Legacy posts: text first, then images
    const result = [];
    if (content?.trim()) pushText(result, content);
    images.forEach(url => result.push({ type: 'image', uri: /^https?:\/\//.test(url) ? url : `${BASE_URL}${url}` }));
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

// Single comment component
function CommentItem({ comment, isReply = false, onMore, onAvatarPress, onReply, editingId, editText, onEditChange, onEditSubmit, onEditCancel, t, styles }) {
  const isEditing = editingId === comment.id;

  // Locked comment (when masked)
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
      {/* Reply indent */}
      {isReply && <Text style={styles.replyIndicatorText}>└</Text>}

      {/* Avatar */}
      <TouchableOpacity
        onPress={() => onAvatarPress?.(comment)}
        activeOpacity={comment.isAnonymous ? 1 : 0.7}
        disabled={comment.isAnonymous || !comment.userId}
      >
        <Avatar nickname={comment.nickname || t('common.anonymous')} uri={comment.isAnonymous ? null : comment.avatarUrl} size={isReply ? 28 : 34} showLetter />
      </TouchableOpacity>

      <View style={styles.commentBody}>
        {/* Top: nickname + pin + lock + time + ··· */}
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

        {/* Body, or the edit input */}
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

// Decide whether the content is HTML
const isHtmlContent = (s) => typeof s === 'string' && /<\w+/.test(s);

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

// Turn relative src paths inside the HTML into absolute URLs
function absolutizeHtml(html) {
  if (!html) return '';
  let out = html;
  out = out.replace(/<span[^>]*data-img-del[^>]*>[\s\S]*?<\/span>/gi, '');
  out = out.replace(/<span[^>]*data-img-wrap[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  return out.replace(/src=["'](\/uploads\/[^"']+)["']/g, `src="${BASE_URL}$1"`);
}

export default function PostDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const htmlTagsStyles = useMemo(() => buildHtmlTagsStyles(colors), [colors]);

  const { postId } = route.params ?? {};
  const { user } = useAuth();
  const { t } = useLang();
  const inputRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { width: winWidth } = useWindowDimensions();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, nickname }
  const [submitting, setSubmitting] = useState(false);

  // Comment edit state
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Locked comment toggle
  const [isSecret, setIsSecret] = useState(false);

  // Like state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);

  // Bookmark state
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // Image viewer
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

  const handleToggleLike = useCallback(async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    // Optimistic update
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

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const refreshComments = async () => {
    const res = await getComments(postId);
    if (res.success) setComments(res.data ?? []);
  };

  // Reply button
  const handleReply = (comment) => {
    setReplyTo({ id: comment.id, nickname: comment.nickname || t('common.anonymous') });
    inputRef.current?.focus();
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyTo(null);
    setCommentText('');
  };

  // Pin comment
  const handlePin = async (comment) => {
    try {
      const res = await pinComment(postId, comment.id);
      if (res.success) refreshComments();
    } catch (e) {
      Alert.alert(t('common.error'), e.message ?? t('post.pinFailed'));
    }
  };

  // Send comment
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

  // Pick a report reason and submit
  // targetType/targetId default to this post, but the same sheet backs comment
  // reports too (handleCommentMore passes targetType: 'comment').
  const showReportSheet = (targetType = 'post', targetId = postId) => {
    const reasons = reportReasons(t);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...reasons.map(r => r.label), t('common.cancel')], cancelButtonIndex: reasons.length, title: t('post.reportPick') },
        async (idx) => { if (idx < reasons.length) await submitReport(targetType, targetId, reasons[idx].key); }
      );
    } else {
      Alert.alert(t('post.reportTitle'), t('post.reportPick'), [
        ...reasons.map(r => ({ text: r.label, onPress: () => submitReport(targetType, targetId, r.key) })),
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  };

  const submitReport = async (targetType, targetId, reason) => {
    try {
      const res = await reportPost({ targetType, targetId, reason });
      if (res.success) Alert.alert(t('post.reportDone'), res.data.message);
      else Alert.alert(t('common.error'), res.message ?? t('post.reportFailed'));
    } catch (e) {
      Alert.alert(t('common.error'), e.message ?? t('post.reportDup'));
    }
  };

  // authorId is the real author id (group posts are never anonymous, so this is
  // the same value as userId today, but keeping both screens on the same field
  // keeps them in lockstep if that ever changes).
  const isPostAuthor = post && user && String(post.authorId ?? post.userId) === String(user.id);

  // Shared by the post-level "block author" action and the per-comment "block" action.
  const confirmBlockUser = (targetUserId, label, onBlocked) => {
    if (!targetUserId) return;
    const nick = label || t('common.anonymous');
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
              const res = await setBlock(targetUserId, { blockChat: true, hideContent: true });
              if (res.success) {
                Alert.alert('', '차단되었어요.', [{ text: 'OK', onPress: onBlocked }]);
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
  const canBlockAuthor = !isPostAuthor && !!(post?.authorId ?? post?.userId);
  const confirmBlockAuthor = () => {
    if (!canBlockAuthor) return;
    confirmBlockUser(post.authorId ?? post.userId, post.nickname, () => navigation.goBack());
  };

  // Trade status toggle (mark filled and so on) — author only, marketplace boards only. Same behaviour as BoardPostDetail.
  const isSold = post?.tradeStatus === 'sold';
  const showTradeButton = isPostAuthor && isTradeBoard(post?.boardSlug);
  const toggleTradeStatus = async () => {
    const next = isSold ? 'selling' : 'sold';
    setPost((prev) => ({ ...prev, tradeStatus: next })); // optimistic
    try {
      const res = await setTradeStatus(post.id, next);
      if (!res.success) {
        setPost((prev) => ({ ...prev, tradeStatus: isSold ? 'sold' : 'selling' }));
        Alert.alert(t('common.error'), res.message ?? t('common.serverError'));
      }
    } catch (e) {
      setPost((prev) => ({ ...prev, tradeStatus: isSold ? 'sold' : 'selling' }));
      Alert.alert(t('common.error'), e.message ?? t('common.serverError'));
    }
  };
  const confirmToggleTradeStatus = () => {
    const next = isSold ? 'selling' : 'sold';
    const nextLabel = getTradeLabel(post.boardSlug, next, t);
    Alert.alert(
      t('board.tradeChangeConfirm').replace('{label}', nextLabel), '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm') || '변경', onPress: toggleTradeStatus, style: 'default' },
      ]
    );
  };

  // Room-rent and homestay posts → list as a stay on the map / view the listed stay (author)
  const isRoomrentBoard = post?.boardSlug === 'roomrent' || String(post?.boardSlug || '').endsWith('-roomrent');
  const [linkedStayId, setLinkedStayId] = useState(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (isPostAuthor && isRoomrentBoard && post?.id) {
      getStayByPost(post.id).then((r) => { if (alive && r?.success) setLinkedStayId(r.stayId || null); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [isPostAuthor, isRoomrentBoard, post?.id]));
  const showStayCta = isPostAuthor && isRoomrentBoard && (linkedStayId || post?.tradeStatus !== 'sold');
  const listOnStayMap = () => {
    // Open within the current tab stack, leaving the map tab alone (this used to pin the map tab to StayCreate)
    navigation.navigate('StayCreate', {
      prefill: { title: post.title, city: post.city, images: post.images || [], content: post.content, sourcePostId: post.id },
    });
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

  // ··· overflow menu
  const handleSharePost = async () => {
    try {
      const preview = (post.content || '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim()
        .slice(0, 120);
      const lines = [
        `[${post.boardName || 'CaMoim'}] ${post.title || ''}`,
      ];
      if (preview) lines.push('', preview + (post.content && post.content.length > 120 ? '…' : ''));
      lines.push('', t('post.shareFooter'));
      await Share.share({ message: lines.join('\n'), title: post.title });
      track('post_share', { postId: String(postId), source: 'home' });
    } catch {}
  };

  const handleMore = () => {
    const L = {
      share: t('post.sharePost'),
      edit: t('post.editPostMenu'),
      del: t('common.delete'),
      report: t('common.report'),
      block: t('post.blockAuthor'),
      cancel: t('common.cancel'),
    };
    const authorOptions = isPostAuthor
      ? [L.share, L.edit, L.del, L.report, L.cancel]
      : (canBlockAuthor ? [L.share, L.report, L.block, L.cancel] : [L.share, L.report, L.cancel]);
    const cancelIdx = authorOptions.length - 1;
    const destructiveIdx = isPostAuthor ? authorOptions.indexOf(L.del) : undefined;

    const handle = (idx) => {
      const action = authorOptions[idx];
      if (action === L.share) handleSharePost();
      else if (action === L.edit) navigation.navigate('EditPost', { editPost: post });
      else if (action === L.del) confirmDeletePost();
      else if (action === L.report) showReportSheet();
      else if (action === L.block) confirmBlockAuthor();
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: authorOptions, cancelButtonIndex: cancelIdx, destructiveButtonIndex: destructiveIdx },
        handle
      );
    } else {
      Alert.alert('', '', authorOptions.filter(o => o !== L.cancel).map(o => ({
        text: o, style: o === L.del ? 'destructive' : 'default',
        onPress: () => handle(authorOptions.indexOf(o)),
      })).concat([{ text: L.cancel, style: 'cancel' }]));
    }
  };

  // Tapping a comment avatar opens My Page for your own, a profile for anyone else
  const handleAvatarPress = (comment) => {
    if (comment.isAnonymous || !comment.userId) return;
    if (user && String(comment.userId) === String(user.id)) {
      navigation.navigate('MyPage');
    } else {
      navigation.push('UserProfile', { userId: comment.userId });
    }
  };

  // Comment ··· overflow
  const handleCommentMore = (comment, isReply) => {
    const isOwn = user && String(comment.userId) === String(user.id);
    const isPostAuth = isPostAuthor;
    // Comments carry a real userId even when isAnonymous masks the nickname/avatar
    // (server/routes/posts.js keeps it "always included, so the client can check
    // permissions" — report and block ride on that same id).
    const canBlockCommenter = !isOwn && !!comment.userId;

    const L = {
      reply: t('post.reply'), copy: t('post.copy'), edit: t('common.edit'),
      del: t('common.delete'), pin: t('post.pinned'), unpin: t('post.unpin'),
      report: t('common.report'), block: t('post.blockAuthor'),
      cancel: t('common.cancel'),
    };
    const opts = [];
    if (!isReply) opts.push(L.reply);
    opts.push(L.copy);
    if (isOwn) { opts.push(L.edit); opts.push(L.del); }
    if (isPostAuth && !isReply) opts.push(comment.isPinned ? L.unpin : L.pin);
    if (!isOwn) opts.push(L.report);
    if (canBlockCommenter) opts.push(L.block);
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
      else if (action === L.report) showReportSheet('comment', comment.id);
      else if (action === L.block) {
        confirmBlockUser(comment.userId, comment.isAnonymous ? t('common.anonymous') : comment.nickname, refreshComments);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: cancelIdx, destructiveButtonIndex: opts.indexOf(L.del), title: t('post.moreActions') },
        handle
      );
    } else {
      Alert.alert(t('post.moreActions'), '', opts.filter(o => o !== L.cancel).map(o => ({
        text: o,
        style: o === L.del ? 'destructive' : 'default',
        onPress: () => handle(opts.indexOf(o)),
      })).concat([{ text: L.cancel, style: 'cancel' }]));
    }
  };

  // Save the edited comment
  const handleEditCommentSave = async (comment) => {
    if (!editingText.trim()) return;
    const res = await editComment(postId, comment.id, editingText.trim());
    if (res.success) { setEditingCommentId(null); refreshComments(); }
    else Alert.alert(t('common.error'), t('post.editFailed'));
  };

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

        {/* ── Post body */}
        <View style={styles.postCard}>

          {/* Board tag (left) + trade status (far right) */}
          {(post.boardName || isTradeBoard(post.boardSlug)) && (
            <View style={styles.tagRow}>
              {post.boardName && <Text style={styles.boardTag}>{post.boardName}</Text>}
              {isTradeBoard(post.boardSlug) && (
                showTradeButton ? (
                  <View style={[styles.tradeSegment, { marginLeft: 'auto' }]}>
                    <TouchableOpacity
                      style={[styles.tradeSegOption, !isSold && styles.tradeSegOptionActive]}
                      onPress={isSold ? confirmToggleTradeStatus : undefined}
                      activeOpacity={isSold ? 0.6 : 1} disabled={!isSold} accessibilityRole="button"
                    >
                      <Text style={[styles.tradeSegText, !isSold ? styles.tradeSegTextActiveSelling : styles.tradeSegTextInactive]}>
                        {getTradeLabel(post.boardSlug, 'selling', t)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tradeSegOption, isSold && styles.tradeSegOptionActive]}
                      onPress={!isSold ? confirmToggleTradeStatus : undefined}
                      activeOpacity={!isSold ? 0.6 : 1} disabled={isSold} accessibilityRole="button"
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

          {/* Title */}
          <Text selectable style={[styles.title, isSold && { color: colors.textSecondary }]}>{post.title}</Text>

          {/* Room-rent and homestay posts → list as a stay on the map / view the listed stay (author) */}
          {showStayCta && (
            <TouchableOpacity
              style={styles.listMapBtn}
              activeOpacity={0.85}
              onPress={linkedStayId ? () => navigation.navigate('StayDetail', { id: linkedStayId }) : listOnStayMap}
            >
              <Ionicons name={linkedStayId ? 'bed' : 'map'} size={15} color="#3B82F6" />
              <Text style={styles.listMapBtnText}>{linkedStayId ? t('stay.viewMyListing') : t('stay.listFromPost')}</Text>
              <Ionicons name="chevron-forward" size={14} color="#3B82F6" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}

          {/* Author row */}
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

          {/* Body: HTML (rich editor) or legacy blocks */}
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

        {/* Flex spacer that pushes scrap/like/comments to the bottom when the body is short */}
        <View style={styles.bottomSpacer} />

        {/* ── Scrap and like buttons */}
        <View style={styles.actionBigWrap}>
          <TouchableOpacity
            style={[styles.actionBigBtn, liked && styles.likeBigBtnActive]}
            onPress={handleToggleLike}
            activeOpacity={0.85}
            disabled={likeBusy}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? '#FF3B6B' : colors.textSecondary}
            />
            <Text style={[styles.actionBigText, liked && styles.likeBigTextActive]}>
              {t('post.likeBtn')} {likeCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBigBtn, bookmarked && styles.bookmarkBigBtnActive]}
            onPress={handleToggleBookmark}
            activeOpacity={0.85}
            disabled={bookmarkBusy}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={bookmarked ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.actionBigText, bookmarked && styles.bookmarkBigTextActive]}>
              {t('post.bookmarkBtn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Comment section */}
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
                    onAvatarPress={handleAvatarPress}
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

      {/* Shows who is being replied to */}
      {replyTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>↩ <Text style={styles.replyBannerNick}>{replyTo.nickname}</Text>{t('post.replyTo2')}</Text>
          <TouchableOpacity onPress={cancelReply} activeOpacity={0.7}>
            <Text style={styles.replyBannerCancel}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom bar */}
      <View style={styles.bottomBar}>
        <View style={styles.barInputWrap}>
        {/* Locked comment toggle */}
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

        {/* Comment input */}
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

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 4 },
  bottomSpacer: { flex: 1, backgroundColor: colors.surface },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 15, color: colors.textSecondary },


  // ── Post card
  postCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: 19,
    paddingTop: 13,
    paddingBottom: 19,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 13,
  },

  // Board tag (coloured text, no background)
  boardTag: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 8,
  },

  // Board tag and trade status on one line (same as BoardPostDetail)
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  listMapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 0, marginBottom: 13, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
  },
  listMapBtnText: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },
  tradeStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tradeStatusPillSelling: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  tradeStatusPillSold: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border },
  tradeDot: { width: 6, height: 6, borderRadius: 3 },
  tradeDotSelling: { backgroundColor: '#10B981' },
  tradeDotSold: { backgroundColor: colors.textSecondary },
  tradeStatusPillText: { fontSize: 11, fontWeight: '800', letterSpacing: -0.2 },
  tradeStatusPillTextSelling: { color: '#047857' },
  tradeStatusPillTextSold: { color: colors.textSecondary },
  tradeSegment: { flexDirection: 'row', backgroundColor: colors.inputBg, borderRadius: 7, padding: 2, alignSelf: 'flex-start' },
  tradeSegOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 5 },
  tradeSegOptionActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 1.5, elevation: 1 },
  tradeSegText: { fontSize: 12, fontWeight: '700', letterSpacing: -0.2 },
  tradeSegTextActiveSelling: { color: '#047857' },
  tradeSegTextActiveSold: { color: colors.text },
  tradeSegTextInactive: { color: colors.textSecondary },

  // Title
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 34,
    letterSpacing: -0.3,
    marginBottom: 13,
  },

  // Author row
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 13,
  },
  authorInfo: { flex: 1, gap: 2 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontSize: 15, fontWeight: '400', color: colors.text },
  authorMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: colors.textSecondary },
  metaDot: { fontSize: 11, color: colors.border },

  // Divider
  contentDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 18,
  },

  // Body
  content: {
    fontSize: 15,
    color: '#2B2B2B',
    lineHeight: 24,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  contentHeading: { fontSize: 19, lineHeight: 28, fontWeight: '800', color: colors.text, marginTop: 4 },
  contentBold: { fontWeight: '800', color: colors.text },
  contentCenter: { textAlign: 'center' },

  // Images (full width, 4:3)
  postImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: colors.border,
    marginBottom: 12,
  },

  // ── Like and scrap buttons
  actionBigWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginBottom: 8,
  },
  actionBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  likeBigBtnActive: {
    borderColor: '#FF3B6B',
    backgroundColor: colors.danger + '12',
  },
  bookmarkBigBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  actionBigText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  likeBigTextActive: { color: '#FF3B6B' },
  bookmarkBigTextActive: { color: colors.primary },

  // ── Comment section
  commentSection: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  commentCount: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  noCommentText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // ── Comment item
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  replyItem: { paddingLeft: 16 },
  pinnedItem: { backgroundColor: colors.primary + '08' },
  replyIndicatorText: { fontSize: 14, color: colors.textSecondary, marginTop: 2, marginRight: -4 },

  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  commentHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentNickname: { fontSize: 13, fontWeight: '700', color: colors.text },
  commentTime: { fontSize: 11, color: colors.textSecondary },
  commentMoreBtn: { fontSize: 16, color: colors.textSecondary, paddingHorizontal: 2 },
  commentContent: { fontSize: 14, color: colors.text, lineHeight: 21, marginBottom: 2 },
  replyActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start' },
  replyActionText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  commentSecretIcon: { fontSize: 14 },
  secretMaskedItem: {},
  secretMaskedText: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', flex: 1 },

  // Pinned badge
  pinnedBadge: {
    backgroundColor: colors.primary + '18',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pinnedBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '700' },

  // Inline comment editing
  editInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  editInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  editSaveBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editSaveText: { fontSize: 13, fontWeight: '700', color: colors.white },
  editCancelText: { fontSize: 13, color: colors.textSecondary },

  // ── Reply banner
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary + '12',
    borderTopWidth: 1,
    borderTopColor: colors.primary + '30',
  },
  replyBannerText: { fontSize: 13, color: colors.textSecondary },
  replyBannerNick: { fontWeight: '700', color: colors.primary },
  replyBannerCancel: { fontSize: 16, color: colors.textSecondary, padding: 4 },

  // ── Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  barInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 24,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  barSep: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: colors.border, marginHorizontal: 2 },
  barInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  barInputSecret: {
    color: colors.primary,
  },
  barLockBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
  },
  barLockBtnActive: {
    backgroundColor: colors.primary + '18',
  },
  barLockIcon: { fontSize: 18 },
  barSendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  barSendBtnInactive: {
    backgroundColor: colors.primary + '55',
  },
  barSendText: { fontSize: 13, fontWeight: '700', color: colors.white },
  barComments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  barCommentsLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  barCommentsCount: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  barIcon: { paddingHorizontal: 12, paddingVertical: 8 },
  barIconText: { fontSize: 16, color: colors.textSecondary },
});
