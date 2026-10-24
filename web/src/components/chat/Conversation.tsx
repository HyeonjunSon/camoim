'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { ChatMessage, ChatMessagesEnvelope, ChatRoomSummary } from '@/lib/types';
import { getSocket, type SocketMessage } from '@/lib/socket';
import { initial } from '@/lib/format';
import { clockTime, dayKey, dayLabel, markReadBy, unreadMark } from '@/lib/chat';
import { useLang, useMessages } from '@/lib/i18n/client';

// False during SSR and the hydration pass, true after — so time text never
// has to match between a UTC server and the viewer's browser.
const noopSubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export default function Conversation({
  room,
  envelope,
  meId,
}: {
  room: ChatRoomSummary;
  envelope: ChatMessagesEnvelope;
  meId: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(envelope.data);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  // `m` is the loop variable for messages below, so the strings are `t`.
  const all = useMessages();
  const t = all.chat;
  const lang = useLang();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  const pendingForMe = room.status === 'pending' && !room.isRequester;
  const pendingFromMe = room.status === 'pending' && room.isRequester;
  const leaderUserId = envelope.school?.leaderUserId ?? null;

  // The server already marked everything read when the page fetched the
  // messages; this re-syncs the room list and the header badge.
  useEffect(() => {
    router.refresh();
    // Only on the first render for a room — refreshing on every change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  useEffect(() => {
    setMessages(envelope.data);
  }, [envelope.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      socket.emit('join_room', room.id);
      socket.emit('read_messages', { roomId: room.id });
    };
    const onDisconnect = () => setConnected(false);
    const onMessage = (payload: SocketMessage) => {
      if (payload.roomId !== room.id) return;
      setMessages((prev) =>
        prev.some((m) => m.id === payload.id) ? prev : [...prev, payload as ChatMessage]
      );
      if (payload.senderId !== meId) socket.emit('read_messages', { roomId: room.id });
    };
    const onRead = ({ roomId, readerId }: { roomId?: string; readerId: string }) => {
      if (roomId && roomId !== room.id) return;
      if (readerId === meId) return;
      setMessages((prev) => markReadBy(prev, readerId));
    };
    const onSendError = ({ message }: { message: string }) => setError(message);
    // A refused handshake is almost always an expired ticket or a revoked
    // session; the page reload re-runs the cookie check and lands on /login if
    // the session is really gone.
    const onConnectError = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new_message', onMessage);
    socket.on('messages_read', onRead);
    socket.on('send_error', onSendError);
    socket.on('connect_error', onConnectError);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.emit('leave_room', room.id);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new_message', onMessage);
      socket.off('messages_read', onRead);
      socket.off('send_error', onSendError);
      socket.off('connect_error', onConnectError);
    };
  }, [room.id, meId]);

  const send = useCallback(() => {
    const content = draft.trim();
    if (!content) return;
    setError(null);
    getSocket().emit('send_message', { roomId: room.id, content });
    setDraft('');
  }, [draft, room.id]);

  async function accept() {
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/chats/${room.id}/accept`, { method: 'PUT' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.acceptFailed);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!window.confirm(t.leaveConfirm)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/chats/${room.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      router.refresh();
      router.replace('/chat');
    } catch (e) {
      setError(e instanceof Error ? e.message : t.leaveFailed);
      setBusy(false);
    }
  }

  const title =
    room.kind === 'group'
      ? (room.group?.name ?? t.groupChat)
      : room.kind === 'school'
        ? (room.school?.name ?? t.schoolChat)
        : room.otherDeleted
          ? all.common.deletedUser
          : (room.other?.nickname ?? all.common.unknown);

  const subtitle =
    room.kind === 'group'
      ? all.common.members(room.group?.memberCount ?? 0)
      : room.kind === 'school'
        ? t.schoolTogether(room.school?.memberCount ?? 0)
        : room.other?.anonymous
          ? t.anonymousSub
          : room.otherLeft
            ? t.otherLeft
            : connected
              ? t.connected
              : t.connecting;

  let lastDay = '';

  return (
    <section className="flex min-h-0 min-w-0 flex-[999_1_520px] flex-col">
      <header className="flex items-center gap-3 border-b border-line-faint px-5 py-3.5">
        <Link
          href="/chat"
          aria-label={t.backToList}
          className="flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-field md:hidden"
        >
          ‹
        </Link>
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint font-bold text-brand-ink"
        >
          {initial(title)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{title}</p>
          <p className="truncate text-[12.5px] text-muted">{subtitle}</p>
        </div>
        {room.kind === 'dm' && room.other?.id && !room.other.anonymous ? (
          <Link
            href={`/users/${room.other.id}`}
            className="hidden h-9 items-center rounded-control border border-line-strong px-3 text-[13px] font-semibold text-ink-3 hover:bg-field sm:flex"
          >
            {t.profile}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={leave}
          disabled={busy}
          className="h-9 rounded-control px-3 text-[13px] font-semibold text-muted hover:bg-field hover:text-danger disabled:opacity-55"
        >
          {t.leave}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#FBFBFD] px-5 py-5">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {t.emptyRoom}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {messages.map((m) => {
              const mine = m.senderId === meId;
              const key = dayKey(m.createdAt);
              const showDay = hydrated && key !== lastDay;
              lastDay = key;
              const isLeader = !!leaderUserId && m.senderId === leaderUserId;
              const unread = unreadMark(m, meId, room.kind);
              return (
                <li key={m.id} className="flex flex-col gap-2.5">
                  {showDay ? (
                    <span className="mx-auto rounded-[10px] bg-[#F0F0F3] px-2.5 py-1 text-xs text-muted">
                      {dayLabel(m.createdAt, undefined, lang)}
                    </span>
                  ) : null}
                  <div
                    className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    {mine ? (
                      <span className="flex flex-col items-end leading-tight">
                        {unread > 0 ? (
                          <span className="text-[11px] font-bold text-brand-strong">
                            {unread}
                            <span className="sr-only-label">{t.unread}</span>
                          </span>
                        ) : null}
                        <span className="text-[11.5px] text-muted">{hydrated ? clockTime(m.createdAt, lang) : ''}</span>
                      </span>
                    ) : null}
                    <div className="max-w-[62%]">
                      {!mine && room.kind !== 'dm' ? (
                        <p className="mb-0.5 flex items-center gap-1 text-[12.5px] text-muted">
                          {m.senderNickname}
                          {isLeader ? <span title={all.common.leader}>⭐</span> : null}
                        </p>
                      ) : null}
                      <p
                        className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
                          mine
                            ? 'bg-brand-strong text-white'
                            : 'border border-line-soft bg-surface text-ink'
                        }`}
                      >
                        {m.content}
                      </p>
                    </div>
                    {!mine ? (
                      <span className="text-[11.5px] text-muted">{hydrated ? clockTime(m.createdAt, lang) : ''}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p role="alert" className="border-t border-line-faint bg-[#FEF2F2] px-5 py-2.5 text-[13px] text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      {pendingForMe ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-line-faint px-5 py-4">
          <p className="flex-1 text-sm text-ink-3">
            {t.requestNote}
          </p>
          <button
            type="button"
            onClick={accept}
            disabled={busy}
            className="h-11 rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
          >
            {t.accept}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2.5 border-t border-line-faint px-4 py-3.5"
        >
          <label htmlFor="chat-input" className="sr-only-label">
            {t.input}
          </label>
          <input
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder={
              pendingFromMe
                ? t.oneMessageOnly
                : t.placeholder
            }
            className="h-11 min-w-0 flex-1 rounded-control border border-line-strong px-3.5 text-[15px] outline-none focus:border-brand-strong"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="h-11 shrink-0 rounded-control bg-brand-strong px-4 font-semibold text-white disabled:opacity-55"
          >
            {t.send}
          </button>
        </form>
      )}
    </section>
  );
}
