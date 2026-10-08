'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useTransition } from 'react';

/**
 * A real checkbox rather than a link styled as one, so it is announced and
 * toggled the way a filter should be. Everything else on the feed filters
 * through plain links; this is the one control where that would be wrong.
 */
export default function TradeFilterToggle({ basePath }: { basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const id = useId();
  const [pending, startTransition] = useTransition();

  const on = params.get('tradeStatus') === 'selling';

  function toggle(next: boolean) {
    const query = new URLSearchParams(params.toString());
    if (next) query.set('tradeStatus', 'selling');
    else query.delete('tradeStatus');
    query.delete('page');
    const qs = query.toString();
    startTransition(() => router.push(qs ? `${basePath}?${qs}` : basePath));
  }

  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 text-[13.5px] text-ink-3"
      data-pending={pending ? '' : undefined}
    >
      <input
        id={id}
        type="checkbox"
        checked={on}
        onChange={(e) => toggle(e.target.checked)}
        className="size-4.5 accent-brand-strong"
      />
      거래중만 보기
    </label>
  );
}
