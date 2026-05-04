import { useState, useRef, useCallback } from 'react';
import { Text } from '../../components/StyledText';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../constants/colors'
import { getMyPosts, deletePost } from '../../lib/api';
import PostCard from '../../components/PostCard';
import { useLang } from '../../context/LangContext';
import EmptyState from '../../components/EmptyState';

// 내가 쓴 글 목록 화면
export default function MyPostsScreen({ navigation }) {
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
      const res = await getMyPosts(pageNum);
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

  const swipeRefs = useRef(new Map());

  const handleDelete = (postId) => {
    Alert.alert(t('common.delete'), t('post.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel', onPress: () => swipeRefs.current.get(postId)?.close() },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deletePost(postId);
            if (res.success) {
              setPosts(prev => prev.filter(p => p.id !== postId));
              setTotal(t => Math.max(0, t - 1));
            } else {
              Alert.alert(t('common.error'), res.message ?? t('common.error'));
            }
          } catch (e) {
            Alert.alert(t('common.error'), e.message ?? t('common.error'));
          }
        },
      },
    ]);
  };

  const renderRightActions = (postId) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => handleDelete(postId)}
      activeOpacity={0.85}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.deleteActionText}>{t('common.delete')}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <Swipeable
            ref={(ref) => { if (ref) swipeRefs.current.set(item.id, ref); }}
            renderRightActions={() => renderRightActions(item.id)}
            overshootRight={false}
          >
            <PostCard
              post={item}
              onPress={() => navigation.navigate('Home', {
                screen: 'PostDetail',
                params: { postId: item.id },
              })}
            />
          </Swipeable>
        )}
        ListEmptyComponent={() => (
          <EmptyState
            emoji="📝"
            title={t('emptyState.noPosts')}
            description={t('emptyState.noPostsCta')}
            ctaLabel={t('emptyState.writeFirst')}
            onCtaPress={() => navigation.navigate('Board')}
          />
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
    </GestureHandlerRootView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  footer: { paddingVertical: 20, alignItems: 'center' },
  deleteAction: {
    backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center',
    width: 80, borderRadius: 14, marginVertical: 4, marginRight: 16,
  },
  deleteActionText: { color: colors.white, fontSize: 11, fontWeight: '600', marginTop: 4 },
});
