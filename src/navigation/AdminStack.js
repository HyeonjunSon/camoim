import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminScreen from '../screens/admin/AdminScreen';
import AdminDetailScreen from '../screens/admin/AdminDetailScreen';
import AdminVerifyScreen from '../screens/admin/AdminVerifyScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminUserDetailScreen from '../screens/admin/AdminUserDetailScreen';
import AdminPostsScreen from '../screens/admin/AdminPostsScreen';
import AdminBoardsScreen from '../screens/admin/AdminBoardsScreen';
import AdminBroadcastScreen from '../screens/admin/AdminBroadcastScreen';
import AdminSystemScreen from '../screens/admin/AdminSystemScreen';
import AdminLogsScreen from '../screens/admin/AdminLogsScreen';
import AdminInquiriesScreen from '../screens/admin/AdminInquiriesScreen';
import NoticeDetailScreen from '../screens/notice/NoticeDetailScreen';
import NoticeEditScreen from '../screens/notice/NoticeEditScreen';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { colors } from '../constants/colors'

const Stack = createNativeStackNavigator();

export default function AdminStack() {
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
      <Stack.Screen name="AdminMain"   component={AdminScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminVerify"  component={AdminVerifyScreen}  options={{ title: t('nav.adminVerify') }} />
      <Stack.Screen name="AdminDetail"  component={AdminDetailScreen}  options={{ title: t('nav.adminDetail') }} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: t('nav.adminReports') }} />
      <Stack.Screen name="AdminUsers"   component={AdminUsersScreen}   options={{ title: t('nav.adminUsers') }} />
      <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} options={{ title: t('nav.adminUserDetail') }} />
      <Stack.Screen name="AdminPosts"   component={AdminPostsScreen}   options={{ title: t('nav.adminPosts') }} />
      <Stack.Screen name="AdminBoards"  component={AdminBoardsScreen}  options={{ title: t('nav.adminBoards') }} />
      <Stack.Screen name="AdminBroadcast" component={AdminBroadcastScreen} options={{ title: t('nav.adminBroadcast') }} />
      <Stack.Screen name="NoticeDetail"  component={NoticeDetailScreen}    options={{ title: t('nav.noticeDetail') }} />
      <Stack.Screen name="NoticeEdit"    component={NoticeEditScreen}      options={{ title: t('nav.noticeEdit') }} />
      <Stack.Screen name="AdminSystem"  component={AdminSystemScreen}  options={{ title: t('nav.adminSystem') }} />
      <Stack.Screen name="AdminLogs"    component={AdminLogsScreen}    options={{ title: t('nav.adminLogs') }} />
      <Stack.Screen name="AdminInquiries" component={AdminInquiriesScreen} options={{ title: t('nav.adminInquiries') }} />
    </Stack.Navigator>
  );
}
