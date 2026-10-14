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

export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto max-w-[1000px] px-4 pt-7 sm:px-6">
      <span className="sr-only-label">불러오는 중</span>
      {children}
    </div>
  );
}
