import 'react-native-gesture-handler'; // 반드시 최상단에 위치
import {
  NavigationContainer,
  createNavigationContainerRef,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LangProvider } from './src/context/LangContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SocketProvider } from './src/context/SocketContext';
import RootNavigator from './src/navigation/RootNavigator';
import AuthStack from './src/navigation/AuthStack';
import { colors } from './src/constants/colors';
import { registerForPushNotifications, addNotificationResponseListener } from './src/lib/notifications';
import SystemStatusGate from './src/components/SystemStatusGate';
import OnboardingScreen, { checkOnboardingDone } from './src/screens/onboarding/OnboardingScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineNotice from './src/components/OfflineNotice';

export const navigationRef = createNavigationContainerRef();

// 로그인 상태에 따라 네비게이터 분기
function AppNavigator() {
  const { user, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(null); // null=checking, true/false

  useEffect(() => {
    checkOnboardingDone().then(setOnboardingDone);
  }, []);

  useEffect(() => {
    if (user) {
      // 로그인 후 푸시 토큰 등록
      registerForPushNotifications();

      // 알림 탭 시 해당 게시글로 이동
      const sub = addNotificationResponseListener((data) => {
        if (!navigationRef.isReady()) return;
        if (data.noticeId) {
          navigationRef.navigate('MyPage', {
            screen: 'NoticeDetail',
            params: { id: data.noticeId },
          });
        } else if (data.postId) {
          navigationRef.navigate('Home', {
            screen: 'PostDetail',
            params: { postId: data.postId },
          });
        }
      });
      return () => sub.remove();
    }
  }, [user]);

  if (loading || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // 첫 실행 시 온보딩 표시
  if (!onboardingDone) {
    return <OnboardingScreen onDone={() => setOnboardingDone(true)} />;
  }

  return user ? <RootNavigator /> : <AuthStack />;
}

export default function App() {
  // Ionicons 폰트 사전 로드
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('./assets/fonts/Pretendard-ExtraBold.otf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LangProvider>
            <AuthProvider>
              <SocketProvider>
                <ThemedNavigation />
              </SocketProvider>
            </AuthProvider>
          </LangProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// 테마(다크/라이트)를 NavigationContainer + StatusBar에 적용
function ThemedNavigation() {
  const { resolved, colors: themeColors } = useTheme();
  const navTheme = resolved === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: themeColors.background,
          card: themeColors.surface,
          text: themeColors.text,
          border: themeColors.border,
          primary: themeColors.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: themeColors.background,
          card: themeColors.surface,
          text: themeColors.text,
          border: themeColors.border,
          primary: themeColors.primary,
        },
      };

  return (
    <ErrorBoundary>
      <NavigationContainer
        ref={navigationRef}
        theme={navTheme}
        onStateChange={() => {
          // iOS가 새 화면 push 시 VC별 statusBar 기본값으로 리셋하는 이슈 방지
          setStatusBarStyle(resolved === 'dark' ? 'light' : 'dark', true);
        }}
      >
        <OfflineNotice />
        <SystemStatusGate>
          <AppNavigator />
        </SystemStatusGate>
        <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
