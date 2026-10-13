'use client';

import { io, type Socket } from 'socket.io-client';

const SOCKET_ORIGIN =
  process.env.NEXT_PUBLIC_SOCKET_ORIGIN ?? 'https://camoim-production.up.railway.app';

/**
 * The browser's socket connection.
 *
 * This is the one place the web talks to Railway directly: a WebSocket is a
 * different origin, so the httpOnly session cookie never reaches it, and Vercel
 * cannot proxy one. The credential is therefore a ticket fetched from our own
 * server, scoped to 'socket' and good for two minutes.
 *
 * `auth` is given as a callback rather than an object because socket.io calls it
 * on every connection attempt. A reconnection half an hour later would otherwise
 * replay a long-expired ticket and fail for good.
 */
let socket: Socket | null = null;

async function fetchTicket(): Promise<string | null> {
  try {
    const res = await fetch('/api/socket-ticket', { method: 'POST' });
    const json = await res.json();
    return json?.success ? (json.data.ticket as string) : null;
  } catch {
    return null;
  }
}

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_ORIGIN, {
    transports: ['websocket'],
    autoConnect: false,
    auth: (cb) => {
      fetchTicket().then((ticket) => cb({ token: ticket ?? '' }));
    },
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

// ── Event payloads, as server/socket.js emits them ────────────────────────────

export type SocketMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderNickname: string;
  content: string;
  readBy: string[];
  createdAt: string;
  kind?: 'dm' | 'group' | 'school';
};

export type ChatNotification = {
  roomId: string;
  kind: 'dm' | 'group' | 'school';
  senderNickname: string;
  content: string;
  groupName?: string;
};
