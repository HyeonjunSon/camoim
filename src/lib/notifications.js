import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from './api';

// Foreground notification display settings
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Called at app start to register the push token.
 * Works on physical devices only (simulators are unsupported).
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    return null;
  }

  // Android notification channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C63FF',
    });
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Obtain the Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'fa0d6f5e-1203-42d3-bd79-b853010f189b',
  });

  const token = tokenData.data;

  // Store the token on the server
  try {
    await registerPushToken(token);
  } catch (e) {
    console.warn('푸시 토큰 서버 저장 실패:', e.message);
  }

  return token;
}

/**
 * Registers the deep-link handler for notification taps
 * @param {function} onNavigate - (data) => void  e.g. navigate to PostDetail
 */
export function addNotificationResponseListener(onNavigate) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data?.postId || data?.noticeId || data?.roomId) {
      onNavigate(data);
    }
  });
}

/**
 * Resets the iOS app icon badge count to 0.
 * Called at app start, on foreground, and when a notification is read.
 */
export async function clearAppBadge() {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (e) {
    // Ignored without permission, or on a simulator
  }
}
