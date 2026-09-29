// Expo push notification helpers
// Covers both iOS and Android through Expo's servers, with no Firebase setup

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Compute the user's exact unread badge count
// = unread notifications + unread chat messages
async function calculateUnreadBadge(userId) {
  if (!userId) return 1;
  try {
    const Notification = require('../models/Notification');
    const ChatRoom = require('../models/ChatRoom');
    const [notifCount, rooms] = await Promise.all([
      // Chat notifications are excluded here (they are counted as chat unread, so this avoids double counting)
      Notification.countDocuments({
        userId,
        isRead: false,
        type: { $nin: ['chat', 'group_chat'] },
      }),
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
 * Send a single push notification
 * @param {string} pushToken - Expo push token (ExponentPushToken[xxx])
 * @param {string} title
 * @param {string} body
 * @param {object} data - extra payload for in-app deep links
 * @param {string} recipientUserId - optional; used to compute an exact badge count
 */
async function sendPush(pushToken, title, body, data = {}, recipientUserId = null) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return;

  // Set the badge from the exact unread count (only when we know the recipient)
  // We are still ahead of the new notification being stored, so add 1 (this push is that unread item)
  let badge = 1;
  if (recipientUserId) {
    const current = await calculateUnreadBadge(recipientUserId);
    badge = current + 1; // Count this push itself
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
