// Expo Push Notification 발송 유틸
// Firebase 설정 없이 Expo 서버를 통해 iOS/Android 모두 지원

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * 단일 푸시 알림 발송
 * @param {string} pushToken - Expo push token (ExponentPushToken[xxx])
 * @param {string} title
 * @param {string} body
 * @param {object} data - 앱 내 딥링크용 추가 데이터
 */
async function sendPush(pushToken, title, body, data = {}) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return;

  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data,
        sound: 'default',
        badge: 1,
      }),
    });
  } catch (e) {
    console.error('푸시 알림 발송 실패:', e.message);
  }
}

module.exports = { sendPush };
