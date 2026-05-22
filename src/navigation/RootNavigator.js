import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { useSocket } from '../context/SocketContext';
import { StyleSheet } from 'react-native';
import { getToken } from '../lib/storage';
import { API_BASE_URL } from '../lib/config';

import HomeStack from './HomeStack';
import BoardStack from './BoardStack';
import ChatStack from './ChatStack';
import SearchStack from './SearchStack';
import MyPageStack from './MyPageStack';
import AdminStack from './AdminStack';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Board: { focused: 'reader', unfocused: 'reader-outline' },
  Search: { focused: 'search', unfocused: 'search-outline' },
  Chat: { focused: 'chatbubbles', unfocused: 'chatbubbles-outline' },
  MyPage: { focused: 'person', unfocused: 'person-outline' },
  Admin: { focused: 'shield', unfocused: 'shield-outline' },
};

// 풀스크린 작성/편집 화면 — 탭바를 숨겨 키보드 + 툴바와 충돌 안 나게
// (iOS는 presentation:'modal'로 이미 가려지지만 Android는 명시적으로 숨겨야 함)
const HIDE_TAB_ROUTES = new Set([
  'CreatePost',
  'EditPost',
  'SchoolCommunityEdit',
  'GroupCommunityEdit',
  'NoticeEdit',
  'ChatRoom',
]);

function getTabBarStyle(route, defaultStyle) {
  const focused = getFocusedRouteNameFromRoute(route);
  if (focused && HIDE_TAB_ROUTES.has(focused)) {
    return { display: 'none' };
  }
  return defaultStyle;
}

export default function RootNavigator() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useLang();
  const { on, off, getActiveRoom } = useSocket();
  const styles = createStyles(colors);
  const isAdmin = user?.role === 'admin';

  // 채팅 탭 뱃지: 총 안읽은 메시지 수
  const [chatBadge, setChatBadge] = useState(0);

  // 포커스 시 + 실시간 갱신
  useEffect(() => {
    async function loadChatBadge() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE_URL}/chats?box=accepted`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          const total = (data.data ?? []).reduce((sum, r) => sum + (r.unreadCount ?? 0), 0);
          setChatBadge(total);
        }
      } catch {}
    }
    loadChatBadge();

    // 새 채팅 알림 → 현재 보고 있는 방이 아닐 때만 뱃지 +1
    on('chat_notification', 'rootTab', (data) => {
      const activeRoom = getActiveRoom();
      if (activeRoom && String(activeRoom) === String(data.roomId)) return;
      setChatBadge(prev => prev + 1);
    });

    // 채팅방에서 읽음 처리했을 때 → 뱃지 다시 계산
    on('messages_read', 'rootTab', () => {
      loadChatBadge();
    });

    return () => {
      off('chat_notification', 'rootTab');
      off('messages_read', 'rootTab');
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          if (!icons) return null;
          return (
            <Ionicons
              name={focused ? icons.focused : icons.unfocused}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: getTabBarStyle(route, styles.tabBar),
        tabBarLabelStyle: styles.tabLabel,
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} options={{ title: t('tabs.home') }} />
      <Tab.Screen name="Board" component={BoardStack} options={{ title: t('tabs.board') }} />
      <Tab.Screen name="Search" component={SearchStack} options={{ title: t('tabs.search') }} />
      <Tab.Screen name="Chat" component={ChatStack} options={{
        title: t('tabs.chat'),
        tabBarBadge: chatBadge > 0 ? (chatBadge > 99 ? '99+' : chatBadge) : undefined,
        tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10, fontWeight: '700' },
      }} />
      <Tab.Screen name="MyPage" component={MyPageStack} options={{ title: t('tabs.mypage') }} />
      {isAdmin && (
        <Tab.Screen name="Admin" component={AdminStack} options={{ title: t('tabs.admin') }} />
      )}
    </Tab.Navigator>
  );
}

const createStyles = (colors) => StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
