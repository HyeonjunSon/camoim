// Prompts for a store update only when a new native version is live (OTA updates stay silent —
// see useOtaUpdate). "Later" is remembered per version, so the same release asks once.
// The hard block for versions below the admin's minimum is SystemStatusGate, not this.
import { useEffect, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../context/LangContext';
import { fetchStoreVersion, isNewerVersion, openStore } from '../lib/storeUpdate';

const DISMISSED_KEY = 'camoim_store_update_dismissed';
const MIN_CHECK_GAP_MS = 6 * 60 * 60 * 1000;

export default function useStoreUpdate() {
  const { t } = useLang();
  const lastCheckAt = useRef(0);
  const prompting = useRef(false);

  useEffect(() => {
    if (__DEV__) return;
    const current = Constants.expoConfig?.version;
    let cancelled = false;

    const check = async () => {
      if (prompting.current || Date.now() - lastCheckAt.current < MIN_CHECK_GAP_MS) return;
      lastCheckAt.current = Date.now();

      const latest = await fetchStoreVersion();
      if (cancelled || !isNewerVersion(latest, current)) return;
      let dismissed = null;
      try { dismissed = await AsyncStorage.getItem(DISMISSED_KEY); } catch {}
      if (cancelled || dismissed === latest) return;

      prompting.current = true;
      Alert.alert(t('storeUpdate.title'), t('storeUpdate.message').replace('{{version}}', latest), [
        {
          text: t('storeUpdate.later'),
          style: 'cancel',
          onPress: () => {
            prompting.current = false;
            AsyncStorage.setItem(DISMISSED_KEY, latest).catch(() => {});
          },
        },
        {
          text: t('storeUpdate.update'),
          onPress: () => { prompting.current = false; openStore(); },
        },
      ]);
    };

    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => { cancelled = true; sub.remove(); };
  }, [t]);
}
