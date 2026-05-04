import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { translate } from '../lib/i18n';
import { setRuntimeLang } from '../lib/runtimeLang';

const STORAGE_KEY = '@camoim_lang';
const LangContext = createContext({ lang: 'ko', setLang: () => {}, t: (k) => k });

function detectInitialLang() {
  try {
    const locales = Localization.getLocales?.();
    const code = (locales && locales[0]?.languageCode) || Localization.locale || 'ko';
    return String(code).toLowerCase().startsWith('ko') ? 'ko' : 'en';
  } catch {
    return 'ko';
  }
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('ko');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const initial = (saved === 'ko' || saved === 'en') ? saved : detectInitialLang();
        setLangState(initial);
        setRuntimeLang(initial);
      } catch {
        const fallback = detectInitialLang();
        setLangState(fallback);
        setRuntimeLang(fallback);
      }
    })();
  }, []);

  const setLang = useCallback(async (next) => {
    setLangState(next);
    setRuntimeLang(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  const t = useCallback((key) => translate(lang, key), [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
