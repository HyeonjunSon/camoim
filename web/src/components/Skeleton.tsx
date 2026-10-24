import { getI18n } from '@/lib/i18n/server';

/**
 * Shared shapes for the loading boundaries.
 *
 * A boundary is only placed on routes that are noindex and signed-in-only. On
 * those, the cost of a boundary — `notFound()` landing after the shell has
 * streamed, so the status is 200 — buys nothing a crawler cares about, and the
 * instant skeleton is what makes a click feel answered. Indexable routes keep
 * their real 404 and get link-level feedback instead.
 */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-shade ${className}`} />;
}

export async function SkeletonPage({ children }: { children: React.ReactNode }) {
  const { m } = await getI18n();
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto max-w-[1000px] px-4 pt-7 sm:px-6">
      <span className="sr-only-label">{m.common.loading}</span>
      {children}
    </div>
  );
}
