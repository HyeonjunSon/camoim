import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
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
import MapStack from './MapStack';
import MyPageStack from './MyPageStack';
import AdminStack from './AdminStack';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Board: { focused: 'reader', unfocused: 'reader-outline' },
  Map: { focused: 'map', unfocused: 'map-outline' },
  Chat: { focused: 'chatbubbles', unfocused: 'chatbubbles-outline' },
  MyPage: { focused: 'person', unfocused: 'person-outline' },
  Admin: { focused: 'shield', unfocused: 'shield-outline' },
};

// Fullscreen compose/edit screens — the tab bar is hidden so it cannot collide with the keyboard and toolbar
// (iOS already covers it with presentation:'modal', but Android needs it hidden explicitly)
const HIDE_TAB_ROUTES = new Set([
  'CreatePost',
  'EditPost',
  'SchoolCommunityEdit',
  'GroupCommunityEdit',
  'NoticeEdit',
  'ChatRoom',
  // Stay screens — the tab bar is hidden so the bottom CTA (mark filled / contact) does not sit on top of it
  'StayCreate',
  'StayDetail',
  'StayMyList',
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

  // Chat tab badge: total unread messages
  const [chatBadge, setChatBadge] = useState(0);

  // Refreshed on focus and in real time
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

    // A new chat notification bumps the badge only when it is not the room currently open
    on('chat_notification', 'rootTab', (data) => {
      const activeRoom = getActiveRoom();
      if (activeRoom && String(activeRoom) === String(data.roomId)) return;
      setChatBadge(prev => prev + 1);
    });

    // Recompute the badge once a room has been marked read
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
      <Tab.Screen name="Home" component={HomeStack} options={{ title: t('tabs.home'), tabBarTestID: 'tab-home' }} />
      <Tab.Screen name="Board" component={BoardStack} options={{ title: t('tabs.board'), tabBarTestID: 'tab-board' }} />
      <Tab.Screen name="Map" component={MapStack} options={{ title: t('tabs.map'), tabBarTestID: 'tab-map' }} />
      <Tab.Screen name="Chat" component={ChatStack} options={{
        title: t('tabs.chat'),
        tabBarTestID: 'tab-chat',
        tabBarBadge: chatBadge > 0 ? (chatBadge > 99 ? '99+' : chatBadge) : undefined,
        tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10, fontWeight: '700' },
      }} />
      <Tab.Screen name="MyPage" component={MyPageStack} options={{ title: t('tabs.mypage'), tabBarTestID: 'tab-mypage' }} />
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
