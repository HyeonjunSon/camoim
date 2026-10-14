import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import NotificationList from '@/components/NotificationList';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import type { AppNotification } from '@/lib/types';

export const metadata: Metadata = {
  title: '알림',
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  // proxy.ts gates this route; a user is expected.
  const [user, notifications] = await Promise.all([
    getCurrentUser(),
    apiFetchOrNull<AppNotification[]>('/notifications'),
  ]);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-7 sm:px-6">
        <NotificationList initial={notifications ?? []} />
      </main>
    </>
  );
}
