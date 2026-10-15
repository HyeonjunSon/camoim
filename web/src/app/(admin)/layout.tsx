import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';
import AdminNav from '@/components/admin/AdminNav';

/**
 * The admin area's own chrome, and its real gate.
 *
 * proxy.ts can only see that a session cookie exists — the role lives on the
 * account — so the check belongs here. Every /api/admin route is guarded
 * independently on the server, so this is a second line rather than the only
 * one; it exists so a non-admin gets a 404 instead of a page full of failed
 * requests.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') notFound();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-2 sm:px-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2 text-ink">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-[9px] bg-ink text-[13px] font-bold text-white"
            >
              AD
            </span>
            <span className="text-lg font-bold -tracking-[0.3px]">운영</span>
          </Link>
          <AdminNav />
          <Link
            href="/"
            className="ml-auto flex h-10 shrink-0 items-center rounded-control border border-line-strong px-3.5 text-sm font-semibold text-ink-3 hover:bg-field"
          >
            사이트로
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
