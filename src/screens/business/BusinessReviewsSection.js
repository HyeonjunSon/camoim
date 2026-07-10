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
  const [editing, setEditing] = useState(false); // 내 리뷰 수정 모드 (수정 버튼 눌렀을 때만 작성창 표시)

  const mine = (reviews || []).find((r) => r.mine);
  // 작성창 노출: 리뷰가 없거나(신규) 수정 모드일 때만
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
    if (!myRating) { showToast('별점을 선택해주세요.'); return; }
    setSaving(true);
    try {
      const res = await upsertBusinessReview(biz.id, { rating: myRating, text: myText.trim() });
      if (res.success) {
        showToast(mine ? '리뷰를 수정했어요.' : '리뷰가 등록되었어요. 감사합니다! 🙌');
        setEditing(false); // 저장 후 작성창 닫기
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
              setMyRating(0); setMyText(''); setEditing(false);
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
    <View style={{ gap: 14 }}>
      {/* 섹션 구분선 + 제목 (별점은 헤더에 이미 있으니 개수만) */}
      <View style={s.divider} />
      <Text style={s.title}>리뷰 {reviews?.length ? reviews.length : ''}</Text>

      {/* 작성창 — 리뷰가 없을 때(신규) 또는 수정 모드일 때만 */}
      {!isLoggedIn ? (
        <Text style={s.loginHint}>로그인하면 리뷰를 남길 수 있어요.</Text>
      ) : showComposer ? (
        <View style={s.writeBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={s.writePrompt}>{editing ? '내 리뷰 수정' : '이곳, 어땠나요?'}</Text>
            {editing && (
              <TouchableOpacity
                onPress={() => {
                  // 취소 → 원래 값으로 되돌리고 닫기
                  setEditing(false);
                  setMyRating(mine?.rating || 0);
                  setMyText(mine?.text || '');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.cancelText}>취소</Text>
              </TouchableOpacity>
            )}
          </View>
          <Stars value={myRating} size={26} onRate={setMyRating} />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <TextInput
              style={s.input}
              value={myText}
              onChangeText={setMyText}
              placeholder="한 줄 평 남기기 (선택)"
              placeholderTextColor={colors.textSecondary}
              maxLength={300}
              multiline
            />
            <TouchableOpacity style={[s.submitBtn, (!myRating || saving) && { opacity: 0.4 }]} disabled={!myRating || saving} onPress={onSubmit}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <Text style={s.submitText}>{editing ? '완료' : '등록'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* 리뷰 목록 */}
      {reviews === null ? (
        <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 8 }} />
      ) : reviews.length === 0 ? (
        <Text style={s.emptyText}>아직 리뷰가 없어요. 첫 리뷰를 남겨보세요! ✍️</Text>
      ) : (
        <View style={{ gap: 0 }}>
          {reviews.map((r, i) => (
            <View key={r.id} style={[s.reviewRow, i > 0 && s.reviewRowBorder]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{(r.nickname || '?').slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.nickname} numberOfLines={1}>{r.nickname}{r.mine ? ' (나)' : ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Stars value={r.rating} size={10} />
                    <Text style={s.dateText}>{formatDate(r.createdAt)}</Text>
                  </View>
                </View>
                {r.mine ? (
                  // 내 리뷰 → 수정 / 삭제 (수정 누르면 위에 작성창이 열림)
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => { setEditing(true); setMyRating(r.rating); setMyText(r.text); }}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Text style={s.editText}>수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                      <Text style={s.deleteText}>삭제</Text>
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
    // 시트가 흰색이라 배경색+테두리로 카드 경계를 확실히
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
