import { TRANSLATIONS } from './i18n';

let currentLang = 'ko';

export function setRuntimeLang(lang) {
  currentLang = lang === 'en' ? 'en' : 'ko';
}

export function getRuntimeLang() {
  return currentLang;
}

export function rt(key) {
  const parts = key.split('.');
  let node = TRANSLATIONS[currentLang];
  for (const p of parts) {
    if (node && typeof node === 'object' && p in node) node = node[p];
    else return key;
  }
  return typeof node === 'string' ? node : key;
}
