import { NextResponse } from 'next/server';
import type { ExchangeRate } from '@/lib/types';

/**
 * CAD -> KRW, same three sources and same order as the app's
 * src/components/CurrencyWidget.js.
 *
 * On the app this runs on the device. In a browser it cannot: Naver and Yahoo
 * send no CORS headers, so the fetch would be blocked. Doing it here also means
 * one upstream call per 10 minutes for every visitor instead of one per visitor.
 */
export const revalidate = 600;

function stamp(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function fromNaver(): Promise<ExchangeRate> {
  const res = await fetch(
    'https://m.stock.naver.com/front-api/marketIndex/prices?category=exchange&reutersCode=FX_CADKRW&page=1',
    { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate } }
  );
  if (!res.ok) throw new Error(`naver ${res.status}`);
  const json = await res.json();
  const row = json?.result?.[0] ?? json?.[0];
  const value = Number(String(row?.closePrice ?? '').replace(/,/g, ''));
  if (!value) throw new Error('naver: no price');
  return { cadToKrw: value, date: stamp(Date.now()), source: 'naver' };
}

async function fromYahoo(): Promise<ExchangeRate> {
  const res = await fetch(
    'https://query1.finance.yahoo.com/v8/finance/chart/CADKRW=X?interval=1d',
    { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate } }
  );
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  const value = Number(meta?.regularMarketPrice);
  if (!value) throw new Error('yahoo: no price');
  const ts = meta?.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now();
  return { cadToKrw: value, date: stamp(ts), source: 'yahoo' };
}

async function fromOpenEr(): Promise<ExchangeRate> {
  const res = await fetch('https://open.er-api.com/v6/latest/CAD', { next: { revalidate } });
  if (!res.ok) throw new Error(`open-er-api ${res.status}`);
  const json = await res.json();
  const value = Number(json?.rates?.KRW);
  if (!value) throw new Error('open-er-api: no KRW');
  const ts = json?.time_last_update_unix ? json.time_last_update_unix * 1000 : Date.now();
  return { cadToKrw: value, date: stamp(ts), source: 'open-er-api' };
}

export async function GET() {
  for (const source of [fromNaver, fromYahoo, fromOpenEr]) {
    try {
      return NextResponse.json({ success: true, data: await source() });
    } catch {
      // try the next source
    }
  }
  // The widget renders a dash rather than a wrong number.
  return NextResponse.json(
    { success: false, message: '환율을 가져올 수 없습니다.' },
    { status: 503 }
  );
}
