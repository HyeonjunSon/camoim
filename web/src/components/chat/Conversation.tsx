'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ChatMessage, ChatMessagesEnvelope, ChatRoomSummary } from '@/lib/types';
import { getSocket, type SocketMessage } from '@/lib/socket';
import { initial } from '@/lib/format';

function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (dayKey(iso) === dayKey(today.toISOString())) return '오늘';
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
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
  const bottomRef = useRef<HTMLDivElement>(null);

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
    const onSendError = ({ message }: { message: string }) => setError(message);
    // A refused handshake is almost always an expired ticket or a revoked
    // session; the page reload re-runs the cookie check and lands on /login if
    // the session is really gone.
    const onConnectError = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new_message', onMessage);
    socket.on('send_error', onSendError);
    socket.on('connect_error', onConnectError);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.emit('leave_room', room.id);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new_message', onMessage);
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
      setError(e instanceof Error ? e.message : '수락하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!window.confirm('이 채팅방을 나갈까요? 대화 내용은 사라져요.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/chats/${room.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      router.refresh();
      router.replace('/chat');
    } catch (e) {
      setError(e instanceof Error ? e.message : '나가지 못했어요.');
      setBusy(false);
    }
  }

  const title =
    room.kind === 'group'
      ? (room.group?.name ?? '모임 채팅')
      : room.kind === 'school'
        ? (room.school?.name ?? '학교 채팅')
        : room.otherDeleted
          ? '탈퇴한 회원'
          : (room.other?.nickname ?? '알 수 없음');

  const subtitle =
    room.kind === 'group'
      ? `멤버 ${room.group?.memberCount ?? 0}명`
      : room.kind === 'school'
        ? `${room.school?.memberCount ?? 0}명이 함께 있어요`
        : room.other?.anonymous
          ? '익명 채팅이에요. 상대 닉네임은 보이지 않아요'
          : room.otherLeft
            ? '상대가 채팅방을 나갔어요'
            : connected
              ? '연결됨'
              : '연결 중…';

  let lastDay = '';

  return (
    <section className="flex min-h-0 min-w-0 flex-[999_1_520px] flex-col">
      <header className="flex items-center gap-3 border-b border-line-faint px-5 py-3.5">
        <Link
          href="/chat"
          aria-label="채팅 목록으로"
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
            프로필
          </Link>
        ) : null}
        <button
          type="button"
          onClick={leave}
          disabled={busy}
          className="h-9 rounded-control px-3 text-[13px] font-semibold text-muted hover:bg-field hover:text-danger disabled:opacity-55"
        >
          나가기
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#FBFBFD] px-5 py-5">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            아직 메시지가 없어요. 먼저 인사해보세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {messages.map((m) => {
              const mine = m.senderId === meId;
              const key = dayKey(m.createdAt);
              const showDay = key !== lastDay;
              lastDay = key;
              const isLeader = !!leaderUserId && m.senderId === leaderUserId;
              return (
                <li key={m.id} className="flex flex-col gap-2.5">
                  {showDay ? (
                    <span className="mx-auto rounded-[10px] bg-[#F0F0F3] px-2.5 py-1 text-xs text-muted">
                      {dayLabel(m.createdAt)}
                    </span>
                  ) : null}
                  <div
                    className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    {mine ? (
                      <span className="text-[11.5px] text-muted">{clockTime(m.createdAt)}</span>
                    ) : null}
                    <div className="max-w-[62%]">
                      {!mine && room.kind !== 'dm' ? (
                        <p className="mb-0.5 flex items-center gap-1 text-[12.5px] text-muted">
                          {m.senderNickname}
                          {isLeader ? <span title="학생회장">⭐</span> : null}
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
                      <span className="text-[11.5px] text-muted">{clockTime(m.createdAt)}</span>
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
            메시지 요청이에요. 수락하면 자유롭게 대화할 수 있어요.
          </p>
          <button
            type="button"
            onClick={accept}
            disabled={busy}
            className="h-11 rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
          >
            수락하기
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
            메시지 입력
          </label>
          <input
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder={
              pendingFromMe
                ? '상대가 수락하기 전에는 한 통만 보낼 수 있어요'
                : '메시지를 입력하세요'
            }
            className="h-11 min-w-0 flex-1 rounded-control border border-line-strong px-3.5 text-[15px] outline-none focus:border-brand-strong"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="h-11 shrink-0 rounded-control bg-brand-strong px-4 font-semibold text-white disabled:opacity-55"
          >
            전송
          </button>
        </form>
      )}
    </section>
  );
}
