// Read receipts — mirrors the app's ChatRoomScreen: a 1:1 message of mine shows
// "1" until the other person has read it. Group and school rooms never show it.

type Receipt = { senderId: string; readBy?: readonly unknown[] | null };

export function unreadMark(message: Receipt, meId: string, kind: string): number {
  if (kind !== 'dm' || String(message.senderId) !== String(meId)) return 0;
  // The sender is always in readBy, so anyone else in it means the other side
  // read it. Checking "not me" rather than the other's id also covers anonymous
  // intro rooms, where the other id is withheld.
  const readByOther = (message.readBy ?? []).some((id) => String(id) !== String(meId));
  return readByOther ? 0 : 1;
}

// Applies a `messages_read` event: the reader has now read every message.
export function markReadBy<T extends { readBy?: string[] | null }>(messages: T[], readerId: string): T[] {
  return messages.map((m) =>
    (m.readBy ?? []).some((id) => String(id) === String(readerId))
      ? m
      : { ...m, readBy: [...(m.readBy ?? []), readerId] }
  );
}

// Times and day dividers are formatted by hand, in the viewer's own zone.
// toLocaleTimeString gave "PM 4:11" on the server (Node's ICU) and "오후 4:11" in
// the browser, and the server runs in UTC anyway — so these are only ever
// rendered after hydration, and never trust the runtime's locale data.
export function clockTime(iso: string, lang: 'ko' | 'en' = 'ko'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (lang === 'en') return `${hour12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
  return `${h < 12 ? '오전' : '오후'} ${hour12}:${mm}`;
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayLabel(iso: string, now: Date = new Date(), lang: 'ko' | 'en' = 'ko'): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === now.getFullYear();
  if (dayKey(iso) === dayKey(now.toISOString())) return lang === 'en' ? 'Today' : '오늘';
  if (lang === 'en') {
    const md = `${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
    return sameYear ? md : `${md}, ${d.getFullYear()}`;
  }
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return sameYear ? md : `${d.getFullYear()}년 ${md}`;
}
