import { useState, useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text } from './StyledText';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../context/LangContext';

const OFFLINE_DEBOUNCE_MS = 2000;
const PING_FALLBACK_MS = 10000;
const PING_URL = 'https://www.google.com/generate_204';
const PING_TIMEOUT_MS = 5000;

async function verifyOnlineByPing() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const res = await fetch(PING_URL, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export default function OfflineNotice() {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    let mounted = true;
    let debounceTimer = null;
    let pingTimer = null;

    const animateTo = (offline) => {
      Animated.spring(slideAnim, {
        toValue: offline ? 0 : -60,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    };

    const setOffline = (offline) => {
      if (!mounted) return;
      setIsOffline((prev) => {
        if (prev === offline) return prev;
        animateTo(offline);
        return offline;
      });
    };

    const schedulePingFallback = () => {
      if (pingTimer) clearTimeout(pingTimer);
      pingTimer = setTimeout(async () => {
        const reallyOnline = await verifyOnlineByPing();
        if (reallyOnline) {
          setOffline(false);
        } else {
          schedulePingFallback();
        }
      }, PING_FALLBACK_MS);
    };

    const clearTimers = () => {
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      if (pingTimer) { clearTimeout(pingTimer); pingTimer = null; }
    };

    const evaluate = (state) => {
      if (state == null || state.isConnected == null) return;
      const looksOffline = state.isConnected === false;

      if (looksOffline) {
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          setOffline(true);
          schedulePingFallback();
        }, OFFLINE_DEBOUNCE_MS);
      } else {
        clearTimers();
        setOffline(false);
      }
    };

    NetInfo.fetch().then(evaluate).catch(() => {});
    const unsubscribe = NetInfo.addEventListener(evaluate);

    return () => {
      mounted = false;
      clearTimers();
      unsubscribe();
    };
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + 4, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.text}>{t('offline.title')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    gap: 8,
  },
  icon: {
    fontSize: 14,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
