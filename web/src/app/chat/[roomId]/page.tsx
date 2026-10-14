import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import ChatRoomList from '@/components/chat/ChatRoomList';
import Conversation from '@/components/chat/Conversation';
import { ApiError, apiFetchEnvelope, apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import type { ChatMessagesEnvelope, ChatRoomSummary } from '@/lib/types';

export const metadata: Metadata = {
  title: '채팅',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ roomId: string }> };

export default async function ChatRoomPage({ params }: Props) {
  const { roomId } = await params;

  // One parallel wave, not three.
  //
  // This used to await the user, then the messages, then the room lists — three
  // serial round trips to an API ~110ms away, before any of their own database
  // work. Opening a conversation took most of a second for no reason. The lists
  // are three because a pending request lives in a different box from an
  // accepted conversation and the room has to be found wherever it is.
  const [user, envelopeResult, accepted, requests, sent] = await Promise.all([
    getCurrentUser(),
    // The envelope carries `kind`, `school` and `otherLeft` beside `data`.
    apiFetchEnvelope<ChatMessagesEnvelope>(`/chats/${roomId}/messages?limit=50`).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error })
    ),
    apiFetchOrNull<ChatRoomSummary[]>('/chats?box=accepted'),
    apiFetchOrNull<ChatRoomSummary[]>('/chats?box=requests'),
    apiFetchOrNull<ChatRoomSummary[]>('/chats?box=sent'),
  ]);

  if (!user) notFound();

  if (!envelopeResult.ok) {
    const err = envelopeResult.error;
    if (err instanceof ApiError && [403, 404].includes(err.status)) notFound();
    throw err;
  }
  const envelope = envelopeResult.value;

  const everyRoom = [...(accepted ?? []), ...(requests ?? []), ...(sent ?? [])];
  const room = everyRoom.find((r) => r.id === roomId);
  if (!room) notFound();

  const box = (requests ?? []).some((r) => r.id === roomId)
    ? 'requests'
    : (sent ?? []).some((r) => r.id === roomId)
      ? 'sent'
      : 'accepted';
  const sideList =
    box === 'requests' ? (requests ?? []) : box === 'sent' ? (sent ?? []) : (accepted ?? []);

  return (
    <>
      <SiteHeader user={user} active="chat" />
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="flex h-[76vh] flex-wrap overflow-hidden rounded-card border border-line-soft bg-surface">
          <div className="hidden md:flex md:flex-[1_1_320px] md:max-w-[360px]">
            <ChatRoomList
              rooms={sideList}
              box={box}
              activeRoomId={roomId}
              requestCount={(requests ?? []).length}
            />
          </div>
          <Conversation room={room} envelope={envelope} meId={user.id} />
        </div>
      </div>
    </>
  );
}
