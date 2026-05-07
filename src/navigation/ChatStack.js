import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';
import GroupDetailScreen from '../screens/group/GroupDetailScreen';
import GroupMembersScreen from '../screens/group/GroupMembersScreen';
import GroupEditScreen from '../screens/group/GroupEditScreen';
import CreatePostScreen from '../screens/board/CreatePostScreen';
import BoardPostDetailScreen from '../screens/board/BoardPostDetailScreen';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { colors } from '../constants/colors'

const Stack = createNativeStackNavigator();

export default function ChatStack() {
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
      <Stack.Screen name="ChatList"    component={ChatListScreen}    options={{ title: t('tabs.chat') }} />
      <Stack.Screen name="ChatRoom"    component={ChatRoomScreen}    options={{ title: t('tabs.chat') }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: t('nav.profile') }} />
      {/* 그룹 채팅에서 헤더의 '모임' 버튼으로 진입 */}
      <Stack.Screen name="GroupDetail"     component={GroupDetailScreen}     options={{ title: t('nav.groupDetail') }} />
      <Stack.Screen name="GroupMembers"    component={GroupMembersScreen}    options={{ title: t('nav.groupMembers') }} />
      <Stack.Screen name="GroupEdit"       component={GroupEditScreen}       options={{ title: '모임 정보 수정' }} />
      <Stack.Screen name="CreatePost"      component={CreatePostScreen}      options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="BoardPostDetail" component={BoardPostDetailScreen} options={{ title: t('post.postTitle') }} />
    </Stack.Navigator>
  );
}
