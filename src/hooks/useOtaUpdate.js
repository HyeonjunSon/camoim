// Expo only swaps in a downloaded OTA update on the *next* cold start, so someone who never fully
// quits the app can sit on a weeks-old bundle — and "just restart the app" actually means quitting
// twice (once to download, once to apply).
//
// OTA updates are never announced. On launch we apply silently: the user has not started anything
// yet, so a reload costs them nothing. On a return from the background they may be mid-sentence,
// so we only download, and Expo swaps it in on the next cold start. Prompts are reserved for new
// store versions (useStoreUpdate).
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

const MIN_CHECK_GAP_MS = 10 * 60 * 1000; // Skip re-checking on every brief app switch

export default function useOtaUpdate() {
  const lastCheckAt = useRef(0);
  const isLaunch = useRef(true);

  useEffect(() => {
    // Updates are inert in dev and in Expo Go, where checkForUpdateAsync throws
    if (__DEV__ || !Updates.isEnabled) return;

    let cancelled = false;

    const check = async () => {
      if (Date.now() - lastCheckAt.current < MIN_CHECK_GAP_MS) return;
      lastCheckAt.current = Date.now();
      const onLaunch = isLaunch.current;
      isLaunch.current = false;

      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable || cancelled) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;

        if (onLaunch) await Updates.reloadAsync();
      } catch {
        // Offline, or the update server is unreachable — just try again next time
      }
    };

    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => { cancelled = true; sub.remove(); };
  }, []);
}
