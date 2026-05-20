import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image';
import { Text } from './StyledText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../constants/colors'
import { SERVER_HOST } from '../lib/config';
import { formatTime } from '../lib/time';
import { useLang } from '../context/LangContext';
import { isTradeBoard, getTradeLabel } from '../constants/boards';

// HTML 태그 + 레거시 마커 제거 후 본문 미리보기
function getPreview(content) {
  if (!content) return '';
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h\d|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\u200B/g, '')
    .replace(/\[IMG:\d+\]/g, '')
    .replace(/\[\/?[BHC]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function PostCard({ post, onPress }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);

  const hasThumbnail = !!post.thumbnail;
  const preview = getPreview(post.content);
  const showTrade = isTradeBoard(post.boardSlug);
  const isSold = showTrade && post.tradeStatus === 'sold';

  return (
    <TouchableOpacity
      style={[styles.card, isSold && styles.cardSold]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* 상단: 텍스트 + 썸네일 */}
      <View style={styles.cardTop}>
        <View style={[styles.cardText, hasThumbnail && { flex: 1, marginRight: 10 }]}>
          {/* 제목 — 거래 상태 알약 prefix */}
          <View style={styles.titleRow}>
            {showTrade && (
              <View style={[styles.tradeBadge, isSold ? styles.tradeBadgeSold : styles.tradeBadgeSelling]}>
                <Text style={[styles.tradeBadgeText, isSold ? styles.tradeBadgeTextSold : styles.tradeBadgeTextSelling]}>
                  {getTradeLabel(post.boardSlug, isSold ? 'sold' : 'selling', t)}
                </Text>
              </View>
            )}
            <Text style={[styles.title, { flex: 1 }]} numberOfLines={2}>{post.title}</Text>
          </View>
          {/* 본문 미리보기 */}
          {preview.length > 0 && (
            <Text style={styles.preview} numberOfLines={2}>{preview}</Text>
          )}
        </View>
        {/* 썸네일 */}
        {hasThumbnail && (
          <Image
            source={{ uri: post.thumbnail.startsWith('http') ? post.thumbnail : `${SERVER_HOST}${post.thumbnail}` }}
            style={styles.thumbnail}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            accessibilityLabel={t('a11y.postImage')}
          />
        )}
      </View>

      {/* 하단: 닉네임·시간·도시 + 통계 — 항상 같은 위치 */}
      <View style={styles.cardBottom}>
        <Text style={styles.nickname}>{post.nickname ?? t('common.anonymous')}</Text>
        {post.authorIsLeader && (
          <Ionicons name="star" size={10} color={colors.primary} style={{ marginLeft: 2 }} />
        )}
        <Text style={styles.dot}>·</Text>
        <Text style={styles.time}>{formatTime(post.createdAt)}</Text>
        {post.city ? (
          <>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.cityTag}>📍{t(`city.${post.city}`) || post.city}</Text>
          </>
        ) : null}
        <View style={styles.stats}>
          <Ionicons name="heart-outline" size={11} color={colors.textSecondary} />
          <Text style={styles.stat}>{post.likeCount ?? 0}</Text>
          <Ionicons name="chatbubble-outline" size={11} color={colors.textSecondary} />
          <Text style={styles.stat}>{post.commentCount ?? 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 3,
  },
  cardSold: {
    opacity: 0.55,
  },
  cardTop: {
    flexDirection: 'row',
  },
  cardText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tradeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tradeBadgeSelling: {
    backgroundColor: '#FEE2E2',
  },
  tradeBadgeSold: {
    backgroundColor: colors.inputBg,
  },
  tradeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  tradeBadgeTextSelling: {
    color: '#DC2626',
  },
  tradeBadgeTextSold: {
    color: colors.textSecondary,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  preview: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  nickname: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  dot: {
    fontSize: 11,
    color: colors.textSecondary,
    marginHorizontal: 3,
  },
  time: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 3,
  },
  stat: {
    fontSize: 10,
    color: colors.textSecondary,
    marginRight: 5,
  },
  cityTag: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
});
