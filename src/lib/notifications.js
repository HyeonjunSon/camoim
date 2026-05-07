import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from './api';

// 포그라운드 알림 표시 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * 앱 시작 시 호출 — 푸시 토큰 등록
 * 실기기에서만 동작 (시뮬레이터 미지원)
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('푸시 알림: 실기기에서만 동작합니다');
    return null;
  }

  // Android 알림 채널 설정
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C63FF',
    });
  }

  // 권한 요청
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('푸시 알림 권한이 거부됐어요');
    return null;
  }

  // Expo Push Token 발급
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'fa0d6f5e-1203-42d3-bd79-b853010f189b',
  });

  const token = tokenData.data;
  console.log('Expo Push Token:', token);

  // 서버에 토큰 저장
  try {
    await registerPushToken(token);
  } catch (e) {
    console.warn('푸시 토큰 서버 저장 실패:', e.message);
  }

  return token;
}

/**
 * 알림 탭 시 딥링크 처리 핸들러 등록
 * @param {function} onNavigate - (data) => void  e.g. navigate to PostDetail
 */
export function addNotificationResponseListener(onNavigate) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data?.postId || data?.noticeId) {
      onNavigate(data);
    }
  });
}

/**
 * iOS 앱 아이콘 뱃지 카운트 0으로 리셋
 * 앱 시작 시 / 포그라운드 전환 시 / 알림 읽음 시 호출
 */
export async function clearAppBadge() {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (e) {
    // 권한 없거나 시뮬레이터면 무시
  }
}
