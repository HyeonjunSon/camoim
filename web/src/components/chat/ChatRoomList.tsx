import Link from 'next/link';
import Image from 'next/image';
import type { ChatRoomSummary } from '@/lib/types';
import { initial, timeAgo } from '@/lib/format';

const BOXES = [
  { id: 'accepted', label: '대화' },
  { id: 'requests', label: '받은 요청' },
  { id: 'sent', label: '보낸 요청' },
] as const;

export type ChatBox = (typeof BOXES)[number]['id'];

function roomTitle(room: ChatRoomSummary): string {
  if (room.kind === 'group') return room.group?.name ?? '모임 채팅';
  if (room.kind === 'school') return room.school?.name ?? '학교 채팅';
  if (room.otherDeleted) return '탈퇴한 회원';
  return room.other?.nickname ?? '알 수 없음';
}

function roomContext(room: ChatRoomSummary): string {
  if (room.kind === 'group') return `모임 · 멤버 ${room.group?.memberCount ?? 0}명`;
  if (room.kind === 'school') return `학교 라운지 · ${room.school?.memberCount ?? 0}명`;
  if (room.other?.anonymous) return '익명 채팅';
  if (room.otherLeft) return '상대가 채팅방을 나갔어요';
  return '1:1 채팅';
}

export default function ChatRoomList({
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
  return (
    <section className="flex w-full flex-[1_1_320px] flex-col border-line-faint md:max-w-[360px] md:border-r">
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-xl font-bold">채팅</h1>
        <nav aria-label="채팅 보관함" className="mt-3 flex gap-1.5">
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
                {b.label}
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
        <p className="px-5 py-10 text-sm text-muted">
          {box === 'accepted'
            ? '아직 대화가 없어요. 글에서 판매자에게 말을 걸어보세요.'
            : box === 'requests'
              ? '받은 요청이 없어요.'
              : '보낸 요청이 없어요.'}
        </p>
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
                      {initial(roomTitle(room))}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2">
                      <span className="truncate text-[15px] font-semibold">{roomTitle(room)}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {timeAgo(room.lastMessageAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {roomContext(room)}
                    </span>
                    <span className="mt-0.5 flex justify-between gap-2">
                      <span className="truncate text-sm text-ink-3">
                        {room.lastMessage || '메시지가 없어요'}
                      </span>
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
