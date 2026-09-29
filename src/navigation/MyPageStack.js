import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyPageScreen from '../screens/mypage/MyPageScreen';
import MyPostsScreen from '../screens/mypage/MyPostsScreen';
import LikedPostsScreen from '../screens/mypage/LikedPostsScreen';
import BookmarkedPostsScreen from '../screens/mypage/BookmarkedPostsScreen';
import StayMyListScreen from '../screens/stay/StayMyListScreen';
import StayDetailScreen from '../screens/stay/StayDetailScreen';
import StayCreateScreen from '../screens/stay/StayCreateScreen';
import VerifyStudentScreen from '../screens/auth/VerifyStudentScreen';
import NotificationSettingsScreen from '../screens/mypage/NotificationSettingsScreen';
import BlockedUsersScreen from '../screens/mypage/BlockedUsersScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';
import NoticesScreen from '../screens/notice/NoticesScreen';
import NoticeDetailScreen from '../screens/notice/NoticeDetailScreen';
import NoticeEditScreen from '../screens/notice/NoticeEditScreen';
import SupportScreen from '../screens/support/SupportScreen';
import FAQScreen from '../screens/support/FAQScreen';
import InquiryFormScreen from '../screens/support/InquiryFormScreen';
import MyInquiriesScreen from '../screens/support/MyInquiriesScreen';
import InquiryDetailScreen from '../screens/support/InquiryDetailScreen';
import LegalDocScreen from '../screens/legal/LegalDocScreen';
import DeleteAccountScreen from '../screens/mypage/DeleteAccountScreen';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { colors } from '../constants/colors'

const Stack = createNativeStackNavigator();

// My page stack
export default function MyPageStack() {
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
      <Stack.Screen name="MyPageMain"    component={MyPageScreen}        options={{ headerShown: false }} />
      <Stack.Screen name="MyPosts"       component={MyPostsScreen}       options={{ title: t('mypage.myPosts') }} />
      <Stack.Screen name="LikedPosts"    component={LikedPostsScreen}    options={{ title: t('mypage.likedPosts') }} />
      <Stack.Screen name="BookmarkedPosts" component={BookmarkedPostsScreen} options={{ title: t('mypage.bookmarkedPosts') }} />
      <Stack.Screen name="StayMyList" component={StayMyListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StayDetail" component={StayDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StayCreate" component={StayCreateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VerifyStudent" component={VerifyStudentScreen} options={{ title: t('mypage.verifyStudent') }} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: t('mypage.notifSettings') }} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: t('mypage.blockedUsers') }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: t('nav.profile') }} />
      <Stack.Screen name="Notices" component={NoticesScreen} options={{ title: t('notice.title') }} />
      <Stack.Screen name="NoticeDetail" component={NoticeDetailScreen} options={{ title: t('notice.title') }} />
      <Stack.Screen name="NoticeEdit" component={NoticeEditScreen} options={{ title: t('nav.noticeWrite') }} />
      <Stack.Screen name="Support" component={SupportScreen} options={{ title: t('support.title') }} />
      <Stack.Screen name="FAQ" component={FAQScreen} options={{ title: t('faq.title') }} />
      <Stack.Screen name="InquiryForm" component={InquiryFormScreen} options={{ title: t('inquiry.title') }} />
      <Stack.Screen name="MyInquiries" component={MyInquiriesScreen} options={{ title: t('inquiry.myTitle') }} />
      <Stack.Screen name="InquiryDetail" component={InquiryDetailScreen} options={{ title: t('inquiry.detailTitle') }} />
      <Stack.Screen name="LegalDoc" component={LegalDocScreen} options={{ title: '' }} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: t('mypage.deleteTitle') }} />
    </Stack.Navigator>
  );
}
