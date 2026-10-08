import Link from 'next/link';

/** Renders one of the plain-text legal documents from src/constants/legal.js. */
export default function LegalDocument({
  title,
  version,
  effectiveDate,
  body,
}: {
  title: string;
  version: string;
  effectiveDate: string;
  body: string;
}) {
  return (
    <main className="mx-auto max-w-[760px] px-4 pb-20 pt-10 sm:px-6">
      <Link href="/" className="text-sm text-brand-ink hover:text-brand-ink-hover">
        ‹ 캐모임 홈
      </Link>
      <h1 className="mt-4 text-2xl font-bold -tracking-[0.4px]">{title}</h1>
      <p className="mt-1.5 text-[13px] text-muted">
        v{version} · {effectiveDate} 시행
      </p>
      <div className="mt-6 rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-7">
        <pre className="font-sans text-[14.5px] leading-[1.8] whitespace-pre-wrap break-words text-ink-2">
          {body}
        </pre>
      </div>
    </main>
  );
}
