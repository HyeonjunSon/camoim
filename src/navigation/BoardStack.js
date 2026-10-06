import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BoardListScreen from '../screens/board/BoardListScreen';
import BoardFeedScreen from '../screens/board/BoardFeedScreen';
import BoardPostDetailScreen from '../screens/board/BoardPostDetailScreen';
import CreatePostScreen from '../screens/board/CreatePostScreen';
import StayCreateScreen from '../screens/stay/StayCreateScreen';
import StayDetailScreen from '../screens/stay/StayDetailScreen';
import IntroScreen from '../screens/intro/IntroScreen';
import IntroCreateScreen from '../screens/intro/IntroCreateScreen';
import IntroDetailScreen from '../screens/intro/IntroDetailScreen';
import UniversityBoardScreen from '../screens/board/UniversityBoardScreen';
import SchoolCommunityEditScreen from '../screens/board/SchoolCommunityEditScreen';
import SchoolMembersScreen from '../screens/board/SchoolMembersScreen';
import VerifyStudentScreen from '../screens/auth/VerifyStudentScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import GroupCreateScreen from '../screens/group/GroupCreateScreen';
import GroupDetailScreen from '../screens/group/GroupDetailScreen';
import GroupMembersScreen from '../screens/group/GroupMembersScreen';
import GroupEditScreen from '../screens/group/GroupEditScreen';
import GroupCommunityEditScreen from '../screens/group/GroupCommunityEditScreen';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { colors } from '../constants/colors'

const Stack = createNativeStackNavigator();

// Board tab stack navigator
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
      <Stack.Screen name="SchoolCommunityEdit" component={SchoolCommunityEditScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SchoolMembers" component={SchoolMembersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BoardFeed"       component={BoardFeedScreen}       options={{ title: t('nav.boardFeed') }} />
      <Stack.Screen name="BoardPostDetail" component={BoardPostDetailScreen} options={{ title: t('post.postTitle') }} />
      <Stack.Screen name="StayCreate" component={StayCreateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StayDetail" component={StayDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="IntroScreen" component={IntroScreen} options={{ headerShown: false }} />
      <Stack.Screen name="IntroDetail" component={IntroDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="IntroCreate" component={IntroCreateScreen} options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="CreatePost"      component={CreatePostScreen}      options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="EditPost"        component={CreatePostScreen}      options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="VerifyStudent"  component={VerifyStudentScreen}   options={{ title: t('mypage.verifyStudent') }} />
      <Stack.Screen name="UserProfile"   component={UserProfileScreen}     options={{ title: t('nav.profile') }} />
      <Stack.Screen name="ChatRoom"      component={ChatRoomScreen}        options={{ title: t('tabs.chat') }} />
      <Stack.Screen name="GroupCreate"   component={GroupCreateScreen}     options={{ title: t('nav.groupCreate') }} />
      <Stack.Screen name="GroupDetail"   component={GroupDetailScreen}     options={{ title: t('nav.groupDetail') }} />
      <Stack.Screen name="GroupMembers"  component={GroupMembersScreen}    options={{ title: t('nav.groupMembers') }} />
      <Stack.Screen name="GroupEdit"     component={GroupEditScreen}       options={{ title: '모임 정보 수정' }} />
      <Stack.Screen name="GroupCommunityEdit" component={GroupCommunityEditScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
