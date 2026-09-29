import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BusinessMapScreen from '../screens/business/BusinessMapScreen';
import BusinessReportScreen from '../screens/business/BusinessReportScreen';
import StayCreateScreen from '../screens/stay/StayCreateScreen';
import StayDetailScreen from '../screens/stay/StayDetailScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';

const Stack = createNativeStackNavigator();

// Map tab stack — business map (root), business submissions and stays (create/detail). Stay inquiries go to ChatRoom, hosts to UserProfile.
export default function MapStack() {
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
      <Stack.Screen name="BusinessMap" component={BusinessMapScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BusinessReport" component={BusinessReportScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StayCreate" component={StayCreateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StayDetail" component={StayDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: t('nav.profile') }} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: t('tabs.chat') }} />
    </Stack.Navigator>
  );
}
