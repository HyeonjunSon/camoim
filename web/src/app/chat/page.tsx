import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import ChatRoomList, { type ChatBox } from '@/components/chat/ChatRoomList';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import type { ChatRoomSummary } from '@/lib/types';

export const metadata: Metadata = {
  title: '채팅',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ box?: string }> };

const BOXES: ChatBox[] = ['accepted', 'requests', 'sent'];

export default async function ChatPage({ searchParams }: Props) {
  const { box: boxParam } = await searchParams;
  const box = (BOXES.includes(boxParam as ChatBox) ? boxParam : 'accepted') as ChatBox;

  // proxy.ts already turned visitors away, so a user is expected here.
  const user = await getCurrentUser();

  const [rooms, requests] = await Promise.all([
    apiFetchOrNull<ChatRoomSummary[]>(`/chats?box=${box}`),
    // The badge on the requests tab, which the current box may not include.
    box === 'requests'
      ? Promise.resolve(null)
      : apiFetchOrNull<ChatRoomSummary[]>('/chats?box=requests'),
  ]);

  const list = rooms ?? [];
  const requestCount = box === 'requests' ? list.length : (requests?.length ?? 0);

  return (
    <>
      <SiteHeader user={user} active="chat" />
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="flex min-h-[70vh] flex-wrap overflow-hidden rounded-card border border-line-soft bg-surface">
          <ChatRoomList rooms={list} box={box} requestCount={requestCount} />
          <section className="hidden flex-[999_1_520px] items-center justify-center p-10 md:flex">
            <p className="text-sm text-muted">왼쪽에서 대화를 골라주세요.</p>
          </section>
        </div>
      </div>
    </>
  );
}
