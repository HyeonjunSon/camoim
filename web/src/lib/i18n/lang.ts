// The viewer's UI language. Korean is the default; English is opt-in through
// the header toggle. Kept in a cookie so the server renders the chosen
// language on the first byte — no flash of Korean before a client swap.
export const LANG_COOKIE = 'camoim_lang';

export type Lang = 'ko' | 'en';

export function parseLang(value: string | undefined | null): Lang {
  return value === 'en' ? 'en' : 'ko';
}

/** For option lists that carry both labels: `{ label: '학생', labelEn: 'Student' }`. */
export function labelFor(item: { label: string; labelEn?: string }, lang: Lang): string {
  return lang === 'en' && item.labelEn ? item.labelEn : item.label;
}
