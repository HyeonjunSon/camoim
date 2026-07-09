import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BusinessMapScreen from '../screens/business/BusinessMapScreen';
import BusinessReportScreen from '../screens/business/BusinessReportScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator();

// 지도 탭 스택 — 업체 지도(루트) + 업체 제보 폼
export default function MapStack() {
  const { colors } = useTheme();
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
    </Stack.Navigator>
  );
}
