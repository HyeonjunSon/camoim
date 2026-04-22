import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate } from '../lib/i18n';

const STORAGE_KEY = '@camoim_lang';
const LangContext = createContext({ lang: 'ko', setLang: () => {}, t: (k) => k });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('ko');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'ko' || saved === 'en') setLangState(saved);
      } catch {}
    })();
  }, []);

  const setLang = useCallback(async (next) => {
    setLangState(next);
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
