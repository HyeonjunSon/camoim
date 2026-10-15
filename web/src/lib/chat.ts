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
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? '오전' : '오후'} ${hour12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (dayKey(iso) === dayKey(now.toISOString())) return '오늘';
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}년 ${md}`;
}
