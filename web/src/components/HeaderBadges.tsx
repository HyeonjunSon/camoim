'use client';

import { useEffect, useState } from 'react';
import { getSocket, type ChatNotification } from '@/lib/socket';
import type { ChatRoomSummary } from '@/lib/types';

/**
 * Both counts are fetched after hydration rather than during the server render.
 *
 * The header sits on every page, and a fetch inside it would run only after that
 * page's own awaits resolved — an extra serial round trip to an API that is a
 * region away from its database (perf/README.md). A badge arriving a moment late
 * costs nothing; a slower first paint on every page does.
 */
function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch('/api/bff/notifications/unread-count')
      .then((r) => r.json())
      .then((json) => {
        if (alive && json?.success) setCount(json.data?.count ?? 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return <Badge count={count} />;
}

export function ChatBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    const load = () =>
      fetch('/api/bff/chats?box=accepted')
        .then((r) => r.json())
        .then((json) => {
          if (!alive || !json?.success) return;
          const rooms = (json.data ?? []) as ChatRoomSummary[];
          setCount(rooms.reduce((sum, r) => sum + (r.unreadCount ?? 0), 0));
        })
        .catch(() => {});

    load();

    // Chat messages are deliberately not stored as notifications (CLAUDE.md,
    // Option B), so the live event is the only way this count moves on its own.
    const socket = getSocket();
    const onNotification = (_payload: ChatNotification) => setCount((n) => n + 1);
    socket.on('chat_notification', onNotification);
    if (!socket.connected) socket.connect();

    return () => {
      alive = false;
      socket.off('chat_notification', onNotification);
    };
  }, []);

  return <Badge count={count} />;
}
