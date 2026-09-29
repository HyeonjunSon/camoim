import 'react-native-gesture-handler'; // Must stay at the very top
import {
  NavigationContainer,
  createNavigationContainerRef,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { View, ActivityIndicator, AppState } from 'react-native';
import { useState, useEffect } from 'react';
import { useFonts } from 'expo-font';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LangProvider } from './src/context/LangContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SocketProvider } from './src/context/SocketContext';
import RootNavigator from './src/navigation/RootNavigator';
import AuthStack from './src/navigation/AuthStack';
import { colors } from './src/constants/colors';
import { registerForPushNotifications, addNotificationResponseListener, clearAppBadge } from './src/lib/notifications';
import SystemStatusGate from './src/components/SystemStatusGate';
import OnboardingScreen, { checkOnboardingDone } from './src/screens/onboarding/OnboardingScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineNotice from './src/components/OfflineNotice';
import { mark } from './src/lib/perf';

export const navigationRef = createNavigationContainerRef();

// Pick the navigator based on auth state
function AppNavigator() {
  const { user, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(null); // null=checking, true/false

  useEffect(() => {
    checkOnboardingDone().then(setOnboardingDone);
  }, []);

  useEffect(() => {
    if (user) {
      // Register the push token after login
      registerForPushNotifications();

      // Clear the iOS icon badge on launch (opening the app counts as having seen the notifications)
      clearAppBadge();

      // Clear the badge again when returning to the foreground
      const appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          clearAppBadge();
        }
      });

      // Tapping a notification navigates to the matching screen
      const sub = addNotificationResponseListener((data) => {
        clearAppBadge(); // Clear the badge as soon as a notification is tapped
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
        } else if (data.roomId) {
          // Chat notification — jump to that room on the chat tab
          // The group/other details ChatRoom needs are fetched by the screen itself
          navigationRef.navigate('Chat', {
            screen: 'ChatRoom',
            params: { roomId: data.roomId, kind: data.kind },
          });
        }
      });
      return () => {
        sub.remove();
        appStateSub.remove();
      };
    }
  }, [user]);

  if (loading || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Show onboarding on first launch
  if (!onboardingDone) {
    return <OnboardingScreen onDone={() => setOnboardingDone(true)} />;
  }

  return user ? <RootNavigator /> : <AuthStack />;
}

function BootSpinner() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export default function App() {
  // Preload the Ionicons font
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('./assets/fonts/Pretendard-ExtraBold.otf'),
  });

  useEffect(() => {
    if (fontsLoaded) mark('fonts_ready');
  }, [fontsLoaded]);

  // Providers mount immediately, independent of fonts, so AuthProvider's session restore starts
  // **at the same time** as font loading. (It used to mount only after the fonts were ready,
  // making font loading and /auth/me serial.) Only the UI waits for the fonts.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <ThemeProvider>
            <LangProvider>
              <AuthProvider>
                <SocketProvider>
                  {fontsLoaded ? <ThemedNavigation /> : <BootSpinner />}
                </SocketProvider>
              </AuthProvider>
            </LangProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

// Apply the theme (dark/light) to NavigationContainer and StatusBar
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
          // Works around iOS resetting the status bar to the per-VC default when a new screen is pushed
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
