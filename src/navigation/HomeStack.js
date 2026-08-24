import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/home/HomeScreen';
import SearchScreen from '../screens/search/SearchScreen';
import PostDetailScreen from '../screens/home/PostDetailScreen';
import CreatePostScreen from '../screens/board/CreatePostScreen';
import BoardFeedScreen from '../screens/board/BoardFeedScreen';
import BoardPostDetailScreen from '../screens/board/BoardPostDetailScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import StayCreateScreen from '../screens/stay/StayCreateScreen';
import NotificationScreen from '../screens/notification/NotificationScreen';
import NoticeDetailScreen from '../screens/notice/NoticeDetailScreen';
import NoticesScreen from '../screens/notice/NoticesScreen';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { colors } from '../constants/colors'

const Stack = createNativeStackNavigator();

// 홈 탭 스택 네비게이터
export default function HomeStack() {
  const { colors } = useTheme();
  const { t } = useLang();
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        headerBackButtonDisplayMode: 'minimal',
        gestureEnabled: true,
      }}
    >
      {/* 홈 피드는 자체 헤더(앱 이름 + 필터 칩)가 있으므로 네이티브 헤더 숨김 */}
      <Stack.Screen name="HomeFeed" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BoardFeed" component={BoardFeedScreen} options={{ title: t('nav.boardFeed') }} />
      <Stack.Screen name="BoardPostDetail" component={BoardPostDetailScreen} options={{ title: t('post.postTitle') }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: t('post.postTitle') }} />
      <Stack.Screen name="CreatePost"   component={CreatePostScreen}  options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="StayCreate"   component={StayCreateScreen}  options={{ headerShown: false }} />
      <Stack.Screen name="EditPost"     component={CreatePostScreen}  options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="UserProfile"  component={UserProfileScreen} options={{ title: t('nav.profile') }} />
      <Stack.Screen name="ChatRoom"      component={ChatRoomScreen}        options={{ title: t('tabs.chat') }} />
      <Stack.Screen name="Notification"  component={NotificationScreen}    options={{ headerShown: false }} />
      <Stack.Screen name="Notices"        component={NoticesScreen}          options={{ title: t('notice.title') }} />
      <Stack.Screen name="NoticeDetail"  component={NoticeDetailScreen}    options={{ title: t('notice.title') }} />
    </Stack.Navigator>
  );
}
