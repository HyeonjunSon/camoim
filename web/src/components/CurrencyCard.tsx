'use client';

import { useEffect, useState } from 'react';
import type { ExchangeRate } from '@/lib/types';
import { useMessages } from '@/lib/i18n/client';

/**
 * Fetched on the client so the home page's server render is not held up by
 * three third-party endpoints. The actual upstream calls happen in
 * /api/rate, which caches them for ten minutes.
 */
export default function CurrencyCard() {
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [failed, setFailed] = useState(false);
  const m = useMessages();

  useEffect(() => {
    let alive = true;
    fetch('/api/rate')
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (json?.success) setRate(json.data as ExchangeRate);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="rounded-card border border-line-soft bg-surface px-5 py-4.5">
      <h2 className="text-[13px] font-semibold text-muted">{m.home.rateTitle}</h2>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-[15px] font-semibold">1 CAD =</span>
        <span className="text-[26px] font-bold -tracking-[0.5px]">
          {rate ? `${rate.cadToKrw.toLocaleString('en-CA', { maximumFractionDigits: 2 })} ${m.home.rateWon}` : '—'}
        </span>
      </p>
      <p className="mt-1.5 text-[12.5px] text-muted">
        {failed ? m.home.rateFailed : rate ? m.home.rateAsOf(rate.date) : m.common.loading}
      </p>
    </section>
  );
}
