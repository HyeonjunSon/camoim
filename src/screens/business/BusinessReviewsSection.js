// Business review section — revealed when the bottom sheet expands
// 1-5 stars plus a one-liner, one review per user per business (writing again edits it), delete your own, report others'
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLang } from '../../context/LangContext';
import {
  getBusinessReviews,
  upsertBusinessReview,
  deleteBusinessReview,
  reportBusinessReview,
} from '../../lib/api';

const PRIMARY = '#7F77DD';
const STAR = '#F59E0B';

// Shared star display/input (size and tap handler are optional)
export function Stars({ value = 0, size = 14, onRate }) {
  return (
    <View style={{ flexDirection: 'row', gap: onRate ? 6 : 1 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = value >= n ? 'star' : value >= n - 0.5 ? 'star-half' : 'star-outline';
        const star = <Ionicons name={icon} size={size} color={STAR} />;
        if (!onRate) return <View key={n}>{star}</View>;
        return (
          <TouchableOpacity key={n} onPress={() => onRate(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            {star}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function BusinessReviewsSection({ biz, colors, isLoggedIn, onAggregate, showToast }) {
  const { t } = useLang();
  const [reviews, setReviews] = useState(null); // null = loading
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false); // Edit mode for my review (the composer only appears after tapping edit)

  const mine = (reviews || []).find((r) => r.mine);
  // Show the composer only when there is no review yet, or while editing
  const showComposer = isLoggedIn && (!mine || editing);

  const load = useCallback(async () => {
    try {
      const res = await getBusinessReviews(biz.id);
      if (res.success) {
        setReviews(res.data || []);
        const my = (res.data || []).find((r) => r.mine);
        if (my) { setMyRating(my.rating); setMyText(my.text); }
      }
    } catch {
      setReviews([]);
    }
  }, [biz.id]);

  useEffect(() => { load(); }, [load]);

  const onSubmit = useCallback(async () => {
    if (!myRating) { showToast(t('biz.pickRating')); return; }
    setSaving(true);
    try {
      const res = await upsertBusinessReview(biz.id, { rating: myRating, text: myText.trim() });
      if (res.success) {
        showToast(mine ? t('biz.reviewUpdated') : t('biz.reviewAdded'));
        setEditing(false); // Close the composer after saving
        onAggregate?.(res.ratingAvg, res.ratingCount);
        load();
      }
    } catch (e) {
      showToast(t('biz.reviewSaveFail'));
    } finally {
      setSaving(false);
    }
  }, [biz.id, myRating, myText, mine, onAggregate, showToast, load, t]);

  const onDelete = useCallback(() => {
    Alert.alert(t('biz.deleteReviewTitle'), t('biz.deleteReviewMsg'), [
      { text: t('biz.cancel'), style: 'cancel' },
      {
        text: t('biz.delete'), style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteBusinessReview(biz.id);
            if (res.success) {
              setMyRating(0); setMyText(''); setEditing(false);
              onAggregate?.(res.ratingAvg, res.ratingCount);
              load();
            }
          } catch (e) { showToast(t('biz.deleteFail')); }
        },
      },
    ]);
  }, [biz.id, onAggregate, showToast, load, t]);

  const onReport = useCallback((review) => {
    Alert.alert(t('biz.reportReviewTitle'), t('biz.reportReviewMsg'), [
      { text: t('biz.cancel'), style: 'cancel' },
      {
        text: t('biz.report'), style: 'destructive',
        onPress: async () => {
          try {
            await reportBusinessReview(biz.id, review.id);
            showToast(t('biz.reportReviewDone'));
          } catch (e) { showToast(t('biz.reportFail')); }
        },
      },
    ]);
  }, [biz.id, showToast, t]);

  const s = createStyles(colors);

  return (
    <View style={{ gap: 14 }}>
      {/* Section divider and title (the rating already sits in the header, so only the count here) */}
      <View style={s.divider} />
      <Text style={s.title}>{t('biz.reviewsTitle')} {reviews?.length ? reviews.length : ''}</Text>

      {/* Composer — only when there is no review yet, or while editing */}
      {!isLoggedIn ? (
        <Text style={s.loginHint}>{t('biz.loginToReview')}</Text>
      ) : showComposer ? (
        <View style={s.writeBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={s.writePrompt}>{editing ? t('biz.editMyReview') : t('biz.howWasIt')}</Text>
            {editing && (
              <TouchableOpacity
                onPress={() => {
                  // Cancel → restore the original values and close
                  setEditing(false);
                  setMyRating(mine?.rating || 0);
                  setMyText(mine?.text || '');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.cancelText}>{t('biz.cancel')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Stars value={myRating} size={26} onRate={setMyRating} />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <TextInput
              style={s.input}
              value={myText}
              onChangeText={setMyText}
              placeholder={t('biz.reviewPh')}
              placeholderTextColor={colors.textSecondary}
              maxLength={300}
              multiline
            />
            <TouchableOpacity style={[s.submitBtn, (!myRating || saving) && { opacity: 0.4 }]} disabled={!myRating || saving} onPress={onSubmit}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <Text style={s.submitText}>{editing ? t('biz.done') : t('biz.submit')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Review list */}
      {reviews === null ? (
        <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 8 }} />
      ) : reviews.length === 0 ? (
        <Text style={s.emptyText}>{t('biz.noReviews')}</Text>
      ) : (
        <View style={{ gap: 0 }}>
          {reviews.map((r, i) => (
            <View key={r.id} style={[s.reviewRow, i > 0 && s.reviewRowBorder]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{(r.nickname || '?').slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.nickname} numberOfLines={1}>{r.nickname}{r.mine ? ` ${t('biz.me')}` : ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Stars value={r.rating} size={10} />
                    <Text style={s.dateText}>{formatDate(r.createdAt)}</Text>
                  </View>
                </View>
                {r.mine ? (
                  // My review → edit / delete (edit opens the composer above)
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => { setEditing(true); setMyRating(r.rating); setMyText(r.text); }}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Text style={s.editText}>{t('biz.edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                      <Text style={s.deleteText}>{t('biz.delete')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => onReport(r)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="flag-outline" size={13} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {!!r.text && <Text style={s.reviewText}>{r.text}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const createStyles = (colors) =>
  StyleSheet.create({
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 2 },
    title: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
    // The sheet is white, so a background colour and border make the card edges clear
    writeBox: {
      backgroundColor: colors.background, borderRadius: 14, padding: 14, gap: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    writePrompt: { fontSize: 13, fontWeight: '700', color: colors.text },
    input: {
      flex: 1, minHeight: 40, maxHeight: 90, paddingHorizontal: 12, paddingVertical: 10,
      backgroundColor: colors.surface, borderRadius: 10, fontSize: 13, color: colors.text,
      borderWidth: 1, borderColor: colors.border,
    },
    submitBtn: {
      backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 16, height: 40,
      alignItems: 'center', justifyContent: 'center',
    },
    submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    deleteText: { fontSize: 12, fontWeight: '600', color: '#FF4444' },
    editText: { fontSize: 12, fontWeight: '600', color: PRIMARY },
    cancelText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    loginHint: { fontSize: 13, color: colors.textSecondary },
    emptyText: { fontSize: 13, color: colors.textSecondary, marginVertical: 4 },
    reviewRow: { gap: 7, paddingVertical: 12 },
    reviewRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    avatar: {
      width: 32, height: 32, borderRadius: 16, backgroundColor: '#EDEBFB',
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '800', color: PRIMARY },
    nickname: { fontSize: 13, fontWeight: '700', color: colors.text },
    dateText: { fontSize: 11, color: colors.textSecondary },
    reviewText: { fontSize: 13, color: colors.text, lineHeight: 20, paddingLeft: 40 },
  });
