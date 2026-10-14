import { Suspense } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { getCurrentUser } from '@/lib/user';

/**
 * Everything with the site chrome lives in this group. The header renders here
 * so it survives navigation between pages — see SiteHeader for why that matters.
 *
 * `getCurrentUser()` is also called by many of the pages below. Next memoises
 * identical fetches within one render, so that is still a single `/auth/me`.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <>
      {/* The header reads the query string, which needs a boundary. */}
      <Suspense fallback={<div className="h-16 border-b border-line bg-surface" />}>
        <SiteHeader user={user} />
      </Suspense>
      {children}
    </>
  );
}
