import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';
import GroupDetailScreen from '../screens/group/GroupDetailScreen';
import GroupMembersScreen from '../screens/group/GroupMembersScreen';
import GroupEditScreen from '../screens/group/GroupEditScreen';
import GroupCommunityEditScreen from '../screens/group/GroupCommunityEditScreen';
import CreatePostScreen from '../screens/board/CreatePostScreen';
import StayCreateScreen from '../screens/stay/StayCreateScreen';
import StayDetailScreen from '../screens/stay/StayDetailScreen';
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
      {/* Reached from a group chat via the header's group button */}
      <Stack.Screen name="GroupDetail"     component={GroupDetailScreen}     options={{ title: t('nav.groupDetail') }} />
      <Stack.Screen name="GroupMembers"    component={GroupMembersScreen}    options={{ title: t('nav.groupMembers') }} />
      <Stack.Screen name="GroupEdit"       component={GroupEditScreen}       options={{ title: '모임 정보 수정' }} />
      <Stack.Screen name="GroupCommunityEdit" component={GroupCommunityEditScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreatePost"      component={CreatePostScreen}      options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="BoardPostDetail" component={BoardPostDetailScreen} options={{ title: t('post.postTitle') }} />
      <Stack.Screen name="StayCreate" component={StayCreateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StayDetail" component={StayDetailScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
