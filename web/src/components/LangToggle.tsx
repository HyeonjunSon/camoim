'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LANG_COOKIE } from '@/lib/i18n/lang';
import { useLang, useMessages } from '@/lib/i18n/client';

/**
 * KO / EN switch. Writes the language cookie and asks the server to re-render,
 * so every server-rendered string flips too — not just client components.
 */
export default function LangToggle() {
  const router = useRouter();
  const lang = useLang();
  const m = useMessages();
  const [pending, startTransition] = useTransition();

  function choose(next: 'ko' | 'en') {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // Keep screen readers and the browser's own translate prompt in step.
    document.documentElement.lang = next;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={m.lang.label}
      title={m.lang.switchTo}
      data-pending={pending ? '' : undefined}
      className="flex h-9 shrink-0 items-center rounded-full bg-field p-0.5 text-[12.5px] font-bold data-pending:opacity-60"
    >
      {(['ko', 'en'] as const).map((value) => (
        <button
          key={value}
          type="button"
          lang={value}
          onClick={() => choose(value)}
          aria-pressed={lang === value}
          className={`h-8 rounded-full px-2.5 transition-colors ${
            lang === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink-3'
          }`}
        >
          {value === 'ko' ? '한국어' : 'EN'}
        </button>
      ))}
    </div>
  );
}
