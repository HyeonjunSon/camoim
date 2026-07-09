// 업체 리뷰 섹션 — 바텀시트 확장 시 노출
// 별점(1~5) + 한줄평, 업체당 1인 1리뷰(다시 쓰면 수정됨), 내 리뷰 삭제, 남의 리뷰 신고
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getBusinessReviews,
  upsertBusinessReview,
  deleteBusinessReview,
  reportBusinessReview,
} from '../../lib/api';

const PRIMARY = '#7F77DD';
const STAR = '#F59E0B';

// 별점 표시/입력 공용 (size, 탭 핸들러 옵션)
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
  const [reviews, setReviews] = useState(null); // null = 로딩 중
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [saving, setSaving] = useState(false);

  const mine = (reviews || []).find((r) => r.mine);

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
    if (!myRating) { showToast('별점을 선택해주세요.'); return; }
    setSaving(true);
    try {
      const res = await upsertBusinessReview(biz.id, { rating: myRating, text: myText.trim() });
      if (res.success) {
        showToast(mine ? '리뷰를 수정했어요.' : '리뷰가 등록되었어요. 감사합니다! 🙌');
        onAggregate?.(res.ratingAvg, res.ratingCount);
        load();
      }
    } catch (e) {
      showToast(e?.message || '리뷰 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }, [biz.id, myRating, myText, mine, onAggregate, showToast, load]);

  const onDelete = useCallback(() => {
    Alert.alert('리뷰 삭제', '내 리뷰를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteBusinessReview(biz.id);
            if (res.success) {
              setMyRating(0); setMyText('');
              onAggregate?.(res.ratingAvg, res.ratingCount);
              load();
            }
          } catch (e) { showToast(e?.message || '삭제에 실패했어요.'); }
        },
      },
    ]);
  }, [biz.id, onAggregate, showToast, load]);

  const onReport = useCallback((review) => {
    Alert.alert('리뷰 신고', '이 리뷰를 신고할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '신고', style: 'destructive',
        onPress: async () => {
          try {
            await reportBusinessReview(biz.id, review.id);
            showToast('신고가 접수되었어요.');
          } catch (e) { showToast(e?.message || '신고에 실패했어요.'); }
        },
      },
    ]);
  }, [biz.id, showToast]);

  const s = createStyles(colors);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={s.title}>리뷰</Text>
        {biz.ratingCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Stars value={biz.ratingAvg} size={13} />
            <Text style={s.avgText}>{biz.ratingAvg.toFixed(1)} ({biz.ratingCount})</Text>
          </View>
        )}
      </View>

      {/* 작성/수정 박스 */}
      {isLoggedIn ? (
        <View style={s.writeBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stars value={myRating} size={22} onRate={setMyRating} />
            {mine && (
              <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.deleteText}>내 리뷰 삭제</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <TextInput
              style={s.input}
              value={myText}
              onChangeText={setMyText}
              placeholder="한 줄 평을 남겨주세요 (선택)"
              placeholderTextColor={colors.textSecondary}
              maxLength={300}
              multiline
            />
            <TouchableOpacity style={[s.submitBtn, (!myRating || saving) && { opacity: 0.5 }]} disabled={!myRating || saving} onPress={onSubmit}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <Text style={s.submitText}>{mine ? '수정' : '등록'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={s.loginHint}>로그인하면 리뷰를 남길 수 있어요.</Text>
      )}

      {/* 리뷰 목록 */}
      {reviews === null ? (
        <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 8 }} />
      ) : reviews.length === 0 ? (
        <Text style={s.emptyText}>아직 리뷰가 없어요. 첫 리뷰를 남겨보세요! ✍️</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {reviews.map((r) => (
            <View key={r.id} style={s.reviewRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.nickname}>{r.nickname}{r.mine ? ' (나)' : ''}</Text>
                <Stars value={r.rating} size={11} />
                <View style={{ flex: 1 }} />
                {!r.mine && (
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

const createStyles = (colors) =>
  StyleSheet.create({
    title: { fontSize: 15, fontWeight: '700', color: colors.text },
    avgText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    writeBox: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 10 },
    input: {
      flex: 1, minHeight: 38, maxHeight: 90, paddingHorizontal: 10, paddingVertical: 8,
      backgroundColor: colors.background, borderRadius: 9, fontSize: 13, color: colors.text,
    },
    submitBtn: {
      backgroundColor: PRIMARY, borderRadius: 9, paddingHorizontal: 14, height: 38,
      alignItems: 'center', justifyContent: 'center',
    },
    submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    deleteText: { fontSize: 12, color: '#FF4444' },
    loginHint: { fontSize: 13, color: colors.textSecondary },
    emptyText: { fontSize: 13, color: colors.textSecondary, marginVertical: 4 },
    reviewRow: { gap: 4, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border || 'rgba(120,120,128,0.2)' },
    nickname: { fontSize: 13, fontWeight: '600', color: colors.text },
    reviewText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  });
