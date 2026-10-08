// Expo only swaps in a downloaded OTA update on the *next* cold start, so someone who never fully
// quits the app can sit on a weeks-old bundle — and "just restart the app" actually means quitting
// twice (once to download, once to apply). This checks on launch and on each return to the
// foreground, downloads anything new, then offers to restart right there.
import { useEffect, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { useLang } from '../context/LangContext';

const MIN_CHECK_GAP_MS = 10 * 60 * 1000; // Skip re-checking on every brief app switch

export default function useOtaUpdate() {
  const { t } = useLang();
  const lastCheckAt = useRef(0);
  const prompting = useRef(false);

  useEffect(() => {
    // Updates are inert in dev and in Expo Go, where checkForUpdateAsync throws
    if (__DEV__ || !Updates.isEnabled) return;

    let cancelled = false;

    const check = async () => {
      if (prompting.current || Date.now() - lastCheckAt.current < MIN_CHECK_GAP_MS) return;
      lastCheckAt.current = Date.now();
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable || cancelled) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;

        prompting.current = true;
        Alert.alert(t('update.title'), t('update.message'), [
          { text: t('update.later'), style: 'cancel', onPress: () => { prompting.current = false; } },
          { text: t('update.restart'), onPress: () => Updates.reloadAsync() },
        ]);
      } catch {
        // Offline, or the update server is unreachable — just try again next time
      }
    };

    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => { cancelled = true; sub.remove(); };
  }, [t]);
}
