import 'server-only';
import { cookies } from 'next/headers';
import { LANG_COOKIE, parseLang, type Lang } from './lang';
import { messages, type Messages } from './messages';

/** The viewer's language, for server components and route handlers. */
export async function getLang(): Promise<Lang> {
  const jar = await cookies();
  return parseLang(jar.get(LANG_COOKIE)?.value);
}

/** The message table for the viewer's language. */
export async function getMessages(): Promise<Messages> {
  return messages[await getLang()];
}

/** Both at once — most server components need the language for helpers and the table for text. */
export async function getI18n(): Promise<{ lang: Lang; m: Messages }> {
  const lang = await getLang();
  return { lang, m: messages[lang] };
}
