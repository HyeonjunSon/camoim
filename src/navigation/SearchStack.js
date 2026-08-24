import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PostDetailScreen from '../screens/home/PostDetailScreen';
import BoardPostDetailScreen from '../screens/board/BoardPostDetailScreen';
import StayCreateScreen from '../screens/stay/StayCreateScreen';
import StayDetailScreen from '../screens/stay/StayDetailScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { colors } from '../constants/colors'

// SearchScreen은 비동기로 생성되므로 lazy import
import SearchScreen from '../screens/search/SearchScreen';

const Stack = createNativeStackNavigator();

export default function SearchStack() {
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
      <Stack.Screen name="SearchHome"  component={SearchScreen}          options={{ headerShown: false }} />
      <Stack.Screen name="PostDetail"  component={PostDetailScreen}      options={{ title: t('post.postTitle') }} />
      <Stack.Screen name="BoardPostDetail" component={BoardPostDetailScreen} options={{ title: t('post.postTitle') }} />
      <Stack.Screen name="StayCreate" component={StayCreateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StayDetail" component={StayDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen}     options={{ title: t('nav.profile') }} />
      <Stack.Screen name="ChatRoom"    component={ChatRoomScreen}        options={{ title: t('tabs.chat') }} />
    </Stack.Navigator>
  );
}
