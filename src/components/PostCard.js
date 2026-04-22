import { View, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Text } from './StyledText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../constants/colors'
import { SERVER_HOST } from '../lib/config';
import { formatTime } from '../lib/time';
import { useLang } from '../context/LangContext';

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

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* 상단: 텍스트 + 썸네일 */}
      <View style={styles.cardTop}>
        <View style={[styles.cardText, hasThumbnail && { flex: 1, marginRight: 10 }]}>
          {/* 제목 */}
          <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
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
            resizeMode="cover"
          />
        )}
      </View>

      {/* 하단: 닉네임·시간·도시 + 통계 — 항상 같은 위치 */}
      <View style={styles.cardBottom}>
        <Text style={styles.nickname}>{post.nickname ?? t('common.anonymous')}</Text>
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
  cardTop: {
    flexDirection: 'row',
  },
  cardText: {
    flex: 1,
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
