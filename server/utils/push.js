// Expo Push Notification 발송 유틸
// Firebase 설정 없이 Expo 서버를 통해 iOS/Android 모두 지원

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// 사용자의 정확한 unread badge 카운트 계산
// = 안 읽은 알림 + 안 읽은 채팅 메시지 합계
async function calculateUnreadBadge(userId) {
  if (!userId) return 1;
  try {
    const Notification = require('../models/Notification');
    const ChatRoom = require('../models/ChatRoom');
    const [notifCount, rooms] = await Promise.all([
      Notification.countDocuments({ userId, isRead: false }),
      ChatRoom.find({ participants: userId }).select('unreadCount').lean(),
    ]);
    let chatCount = 0;
    for (const room of rooms) {
      if (room.unreadCount && typeof room.unreadCount === 'object') {
        const n = Number(room.unreadCount[String(userId)] ?? 0);
        if (Number.isFinite(n) && n > 0) chatCount += n;
      }
    }
    return Math.max(0, notifCount + chatCount);
  } catch (e) {
    console.error('[push] calculateUnreadBadge failed:', e.message);
    return 1; // fallback
  }
}

/**
 * 단일 푸시 알림 발송
 * @param {string} pushToken - Expo push token (ExponentPushToken[xxx])
 * @param {string} title
 * @param {string} body
 * @param {object} data - 앱 내 딥링크용 추가 데이터
 * @param {string} recipientUserId - (선택) 수신자 유저 ID — 정확한 badge 카운트 계산용
 */
async function sendPush(pushToken, title, body, data = {}, recipientUserId = null) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return;

  // 정확한 unread 카운트로 badge 설정 (수신자 ID 있을 때만)
  // 새 알림이 +1 되기 전 시점이라 +1 보정 (이 push 자체가 다음 읽지 않은 1건)
  let badge = 1;
  if (recipientUserId) {
    const current = await calculateUnreadBadge(recipientUserId);
    badge = current + 1; // 이 푸시 자체를 +1
  }

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
        badge,
      }),
    });
  } catch (e) {
    console.error('푸시 알림 발송 실패:', e.message);
  }
}

module.exports = { sendPush, calculateUnreadBadge };
