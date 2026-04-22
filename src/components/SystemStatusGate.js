import { useState, useEffect } from 'react';
import { Text } from './StyledText';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import {
  subscribeSystemStatus,
  getSystemStatus,
  clearSystemStatus,
} from '../lib/systemStatus';

// 남은 정지 기간 계산
function formatRemaining(until, t) {
  if (!until) return t('system.indefinite');
  const diff = new Date(until) - new Date();
  if (diff <= 0) return t('system.soonLifted');
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const hours = Math.ceil(diff / (1000 * 60 * 60));
  if (days > 1) return `${days}d`;
  return `${hours}h`;
}

// 점검/강제업데이트/IP 차단/계정 정지 등을 풀스크린으로 가로막는 게이트
export default function SystemStatusGate({ children }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { logout } = useAuth();
  const { t } = useLang();

  const [status, setStatus] = useState(getSystemStatus());

  useEffect(() => subscribeSystemStatus(setStatus), []);

  if (!status) return children;

  const { code, message, minVersion, suspendedUntil } = status;

  let icon = 'alert-circle';
  let title = t('system.notice');
  let canDismiss = false;
  let actionLabel = null;
  let onAction = null;

  if (code === 'MAINTENANCE') {
    icon = 'construct';
    title = t('system.maintenance');
  } else if (code === 'UPDATE_REQUIRED') {
    icon = 'cloud-download';
    title = t('system.updateRequired');
    actionLabel = t('system.openStore');
    onAction = () => {
      const url = Platform.OS === 'ios'
        ? 'itms-apps://apps.apple.com'
        : 'market://details?id=com.camoim.app';
      Linking.openURL(url).catch(() => {});
    };
  } else if (code === 'IP_BLOCKED') {
    icon = 'ban';
    title = t('system.accessBlocked');
  } else if (code === 'ACCOUNT_SUSPENDED') {
    icon = 'pause-circle';
    title = t('system.suspended');
    canDismiss = true;
  } else if (code === 'ACCOUNT_BANNED') {
    icon = 'close-circle';
    title = t('system.banned');
    canDismiss = true;
  }

  const handleDismiss = () => {
    clearSystemStatus();
    logout();
  };

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color={colors.primary} />
      <Text style={styles.title}>{title}</Text>
      {!!message && <Text style={styles.message}>{message}</Text>}

      {code === 'ACCOUNT_SUSPENDED' && (
        <View style={styles.remainingBox}>
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={styles.remainingText}>{formatRemaining(suspendedUntil, t)}</Text>
        </View>
      )}

      {!!minVersion && (
        <Text style={styles.meta}>최소 버전: {minVersion}</Text>
      )}

      {actionLabel && (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}

      {canDismiss && (
        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
          <Text style={styles.dismissText}>{t('mypage.logout')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: colors.background, gap: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 8 },
  message: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  meta: { fontSize: 12, color: colors.textSecondary },
  remainingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary + '15', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, marginTop: 4,
  },
  remainingText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  actionBtn: {
    marginTop: 20, paddingHorizontal: 28, paddingVertical: 14,
    backgroundColor: colors.primary, borderRadius: 12,
  },
  actionText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  dismissBtn: { marginTop: 16, padding: 10 },
  dismissText: { color: colors.textSecondary, fontSize: 13 },
});
