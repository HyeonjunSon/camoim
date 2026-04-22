import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';
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
    </Stack.Navigator>
  );
}
