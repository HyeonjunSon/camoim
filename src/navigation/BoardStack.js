import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BoardListScreen from '../screens/board/BoardListScreen';
import BoardFeedScreen from '../screens/board/BoardFeedScreen';
import BoardPostDetailScreen from '../screens/board/BoardPostDetailScreen';
import CreatePostScreen from '../screens/board/CreatePostScreen';
import UniversityBoardScreen from '../screens/board/UniversityBoardScreen';
import VerifyStudentScreen from '../screens/auth/VerifyStudentScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import GroupCreateScreen from '../screens/group/GroupCreateScreen';
import GroupDetailScreen from '../screens/group/GroupDetailScreen';
import GroupMembersScreen from '../screens/group/GroupMembersScreen';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { colors } from '../constants/colors'

const Stack = createNativeStackNavigator();

// 게시판 탭 스택 네비게이터
export default function BoardStack() {
  const { colors } = useTheme();
  const { t } = useLang();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitleVisible: false,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="BoardList"       component={BoardListScreen}       options={{ title: t('board.title') }} />
      <Stack.Screen name="UniversityBoard" component={UniversityBoardScreen} options={{ title: t('nav.schoolCommunity') }} />
      <Stack.Screen name="BoardFeed"       component={BoardFeedScreen}       options={{ title: t('nav.boardFeed') }} />
      <Stack.Screen name="BoardPostDetail" component={BoardPostDetailScreen} options={{ title: t('post.postTitle') }} />
      <Stack.Screen name="CreatePost"      component={CreatePostScreen}      options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="EditPost"        component={CreatePostScreen}      options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="VerifyStudent"  component={VerifyStudentScreen}   options={{ title: t('mypage.verifyStudent') }} />
      <Stack.Screen name="UserProfile"   component={UserProfileScreen}     options={{ title: t('nav.profile') }} />
      <Stack.Screen name="ChatRoom"      component={ChatRoomScreen}        options={{ title: t('tabs.chat') }} />
      <Stack.Screen name="GroupCreate"   component={GroupCreateScreen}     options={{ title: t('nav.groupCreate') }} />
      <Stack.Screen name="GroupDetail"   component={GroupDetailScreen}     options={{ title: t('nav.groupDetail') }} />
      <Stack.Screen name="GroupMembers"  component={GroupMembersScreen}    options={{ title: t('nav.groupMembers') }} />
    </Stack.Navigator>
  );
}
