'use client';

import { createContext, useContext } from 'react';
import type { Lang } from './lang';
import { messages, type Messages } from './messages';

const LangContext = createContext<Lang>('ko');

/** Set once in the root layout from the cookie the server already read. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useMessages(): Messages {
  return messages[useContext(LangContext)];
}
