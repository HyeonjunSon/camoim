'use client';

import { useEffect, useState } from 'react';
import type { ExchangeRate } from '@/lib/types';

/**
 * Fetched on the client so the home page's server render is not held up by
 * three third-party endpoints. The actual upstream calls happen in
 * /api/rate, which caches them for ten minutes.
 */
export default function CurrencyCard() {
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [failed, setFailed] = useState(false);

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
      <h2 className="text-[13px] font-semibold text-muted">실시간 환율</h2>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-[15px] font-semibold">1 CAD =</span>
        <span className="text-[26px] font-bold -tracking-[0.5px]">
          {rate ? `${rate.cadToKrw.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} 원` : '—'}
        </span>
      </p>
      <p className="mt-1.5 text-[12.5px] text-muted">
        {failed ? '환율을 가져오지 못했어요.' : rate ? `${rate.date} 기준` : '불러오는 중…'}
      </p>
    </section>
  );
}
