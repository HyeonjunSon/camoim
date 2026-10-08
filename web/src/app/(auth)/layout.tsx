import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="flex items-center gap-2 text-ink">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-[10px] bg-brand text-lg font-bold text-white"
        >
          C
        </span>
        <span className="text-[22px] font-bold -tracking-[0.4px]">캐모임</span>
      </Link>
      <main className="mt-7 w-full max-w-[420px] rounded-card border border-line-soft bg-surface px-6 py-7 sm:px-8">
        {children}
      </main>
    </div>
  );
}
