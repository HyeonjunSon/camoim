import Link from 'next/link';
import Image from 'next/image';
import type { ChatRoomSummary } from '@/lib/types';
import { initial, timeAgo } from '@/lib/format';
import LinkPending from '../LinkPending';
import NewChatDialog from './NewChatDialog';
import { getI18n } from '@/lib/i18n/server';
import type { Messages } from '@/lib/i18n/messages';

const BOXES = [
  { id: 'accepted' },
  { id: 'requests' },
  { id: 'sent' },
] as const;

export type ChatBox = (typeof BOXES)[number]['id'];

function roomTitle(room: ChatRoomSummary, m: Messages): string {
  if (room.kind === 'group') return room.group?.name ?? m.chat.groupChat;
  if (room.kind === 'school') return room.school?.name ?? m.chat.schoolChat;
  if (room.otherDeleted) return m.common.deletedUser;
  return room.other?.nickname ?? m.common.unknown;
}

function roomContext(room: ChatRoomSummary, m: Messages): string {
  if (room.kind === 'group') return m.chat.groupSub(room.group?.memberCount ?? 0);
  if (room.kind === 'school') return m.chat.schoolSub(room.school?.memberCount ?? 0);
  if (room.other?.anonymous) return m.chat.anonymousChat;
  if (room.otherLeft) return m.chat.otherLeft;
  return m.chat.dm;
}

export default async function ChatRoomList({
  rooms,
  box,
  activeRoomId,
  requestCount,
}: {
  rooms: ChatRoomSummary[];
  box: ChatBox;
  activeRoomId?: string;
  requestCount: number;
}) {
  const { lang, m } = await getI18n();
  return (
    <section className="flex w-full flex-[1_1_320px] flex-col border-line-faint md:max-w-[360px] md:border-r">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">{m.chat.title}</h1>
          {/* Every other way into a conversation lives on another page, so the
              chat tab needs one of its own. */}
          <NewChatDialog />
        </div>
        <nav aria-label={m.chat.boxes} className="mt-3 flex gap-1.5">
          {BOXES.map((b) => {
            const on = b.id === box;
            return (
              <Link
                key={b.id}
                href={b.id === 'accepted' ? '/chat' : `/chat?box=${b.id}`}
                aria-current={on ? 'true' : undefined}
                className={`flex h-9 items-center gap-1.5 rounded-pill border px-3 text-[13.5px] font-semibold ${
                  on
                    ? 'border-ink bg-ink text-white'
                    : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
                }`}
              >
                {m.chat[b.id]}
                {b.id === 'requests' && requestCount > 0 ? (
                  <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
                    {requestCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {rooms.length === 0 ? (
        <div className="px-5 py-10">
          <p className="text-sm text-muted">
            {box === 'accepted'
              ? m.chat.emptyAccepted
              : box === 'requests'
                ? m.chat.emptyRequests
                : m.chat.emptySent}
          </p>
          {box === 'accepted' ? (
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              {m.chat.howToPre}
              <strong className="text-ink-3">{m.chat.howToNew}</strong>
              {m.chat.howToPost}
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto border-t border-line-faint">
          {rooms.map((room) => {
            const on = room.id === activeRoomId;
            const avatar = room.kind === 'dm' && !room.other?.anonymous ? room.other?.avatarUrl : null;
            return (
              <li key={room.id}>
                <Link
                  href={`/chat/${room.id}`}
                  aria-current={on ? 'true' : undefined}
                  className={`flex items-center gap-3 px-5 py-3.5 text-ink ${
                    on ? 'bg-brand-tint-soft' : 'hover:bg-field'
                  }`}
                >
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt=""
                      width={46}
                      height={46}
                      className="size-11.5 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-11.5 shrink-0 items-center justify-center rounded-full bg-brand-tint font-bold text-brand-ink"
                    >
                      {initial(roomTitle(room, m))}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2">
                      <span className="truncate text-[15px] font-semibold">{roomTitle(room, m)}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {timeAgo(room.lastMessageAt, undefined, lang)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {roomContext(room, m)}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-ink-3">
                        {room.lastMessage || m.chat.noMessages}
                      </span>
                      <LinkPending />
                      {room.unreadCount > 0 ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[11.5px] font-bold text-white">
                          {room.unreadCount}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
