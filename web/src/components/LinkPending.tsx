'use client';

import { useLinkStatus } from 'next/link';

/**
 * Drop inside a `<Link>` to show that the click registered.
 *
 * Opening a conversation is a server render that still has to talk to the API,
 * so without this the row looks inert for a few hundred milliseconds and the
 * click reads as ignored. `useLinkStatus` has to live in a client component
 * inside the link, which is all this is — the link itself stays on the server.
 */
export default function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      role="status"
      aria-label="여는 중"
      className={
        className ??
        'size-4 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-brand-ink'
      }
    />
  );
}
