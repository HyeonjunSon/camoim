import { useState, useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text } from './StyledText';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../context/LangContext';

export default function OfflineNotice() {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      Animated.spring(slideAnim, {
        toValue: offline ? 0 : -60,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    });
    return () => unsubscribe();
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
