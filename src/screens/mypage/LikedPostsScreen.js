import { useState, useCallback } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { getLikedPosts } from '../../lib/api';
import PostCard from '../../components/PostCard';
import { useLang } from '../../context/LangContext';

// 좋아요한 글 목록
export default function LikedPostsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLang();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (pageNum = 1, isRefresh = false) => {
    if (pageNum === 1) {
      isRefresh ? setRefreshing(true) : setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const res = await getLikedPosts(pageNum);
      if (res.success) {
        const newPosts = res.data.posts ?? [];
        setPosts(prev => pageNum === 1 ? newPosts : [...prev, ...newPosts]);
        setTotal(res.data.total ?? 0);
        setPage(pageNum);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const onEndReached = () => {
    if (loadingMore || posts.length >= total) return;
    load(page + 1);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => {
              if (item.boardId) {
                navigation.navigate('Board', {
                  screen: 'BoardPostDetail',
                  params: { postId: item.id },
                });
              } else {
                navigation.navigate('Home', {
                  screen: 'PostDetail',
                  params: { postId: item.id },
                });
              }
            }}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>❤️</Text>
            <Text style={styles.emptyText}>{t('mypage.noLiked')}</Text>
            <Text style={styles.emptySub}>❤️</Text>
          </View>
        )}
        ListFooterComponent={() => loadingMore
          ? <View style={styles.footer}><ActivityIndicator size="small" color={colors.primary} /></View>
          : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(1, true)} tintColor={colors.primary} />
        }
        contentContainerStyle={posts.length === 0 ? { flexGrow: 1 } : null}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  emptySub: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  footer: { paddingVertical: 20, alignItems: 'center' },
});
