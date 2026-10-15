'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminSettings } from '@/lib/types';

/**
 * System settings, each key written back on its own (`PUT /settings/:key`).
 *
 * These can take the product down, so every panel says what it does before it
 * is saved and the two switches confirm. The server caches settings for five
 * seconds and invalidates on write, so a change lands almost immediately.
 */
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
      <h2 className="text-[16px] font-bold">{title}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SettingsPanels({ settings }: { settings: AdminSettings }) {
  const router = useRouter();
  const [maintenance, setMaintenance] = useState(settings.maintenance);
  const [forceUpdate, setForceUpdate] = useState(settings.forceUpdate);
  const [bannedWords, setBannedWords] = useState(settings.bannedWords.join('\n'));
  const [blockedIps, setBlockedIps] = useState(settings.blockedIps.join('\n'));
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(key: string, value: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/bff/admin/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '저장하지 못했어요.');
      setSaved(key);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(null);
    }
  }

  /** One per line, blanks dropped — the API stores an array. */
  const toList = (text: string) =>
    text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

  const input =
    'h-11 w-full rounded-control border border-line-strong px-3.5 text-[15px] outline-none focus:border-brand-strong';
  const area =
    'w-full resize-y rounded-control border border-line-strong px-3.5 py-2.5 font-mono text-[13.5px] outline-none focus:border-brand-strong';
  const button =
    'flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55';

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <Panel
        title="점검 모드"
        description="켜면 앱과 웹의 모든 API가 503을 돌려줘요. 로그인만 열어두기 때문에 운영자는 들어올 수 있어요."
      >
        <label className="flex items-center gap-2.5 text-[15px] font-semibold">
          <input
            type="checkbox"
            checked={maintenance.enabled}
            onChange={(e) => setMaintenance((m) => ({ ...m, enabled: e.target.checked }))}
            className="size-4.5 accent-brand-strong"
          />
          점검 모드 켜기
        </label>
        <label htmlFor="maint-msg" className="mt-3 block text-[13.5px] font-semibold text-ink-3">
          안내 문구
        </label>
        <input
          id="maint-msg"
          value={maintenance.message}
          onChange={(e) => setMaintenance((m) => ({ ...m, message: e.target.value }))}
          placeholder="시스템 점검 중입니다"
          className={`${input} mt-1.5`}
        />
        <button
          type="button"
          disabled={busy === 'maintenance'}
          onClick={() =>
            save(
              'maintenance',
              maintenance,
              maintenance.enabled
                ? '점검 모드를 켤까요? 모든 사용자가 앱과 웹을 쓸 수 없게 돼요.'
                : undefined
            )
          }
          className={`${button} mt-3`}
        >
          {busy === 'maintenance' ? '저장 중…' : '점검 모드 저장'}
        </button>
        {saved === 'maintenance' ? (
          <p role="status" className="mt-2 text-[13px] text-positive">
            저장됐어요.
          </p>
        ) : null}
      </Panel>

      <Panel
        title="강제 업데이트"
        description="앱이 보내는 x-app-version이 최소 버전보다 낮으면 426을 돌려줘요. 웹은 이 헤더를 보내지 않으므로 영향을 받지 않아요."
      >
        <label className="flex items-center gap-2.5 text-[15px] font-semibold">
          <input
            type="checkbox"
            checked={forceUpdate.enabled}
            onChange={(e) => setForceUpdate((f) => ({ ...f, enabled: e.target.checked }))}
            className="size-4.5 accent-brand-strong"
          />
          강제 업데이트 켜기
        </label>
        <label htmlFor="min-version" className="mt-3 block text-[13.5px] font-semibold text-ink-3">
          최소 버전
        </label>
        <input
          id="min-version"
          value={forceUpdate.minVersion}
          onChange={(e) => setForceUpdate((f) => ({ ...f, minVersion: e.target.value }))}
          placeholder="1.0.8"
          className={`${input} mt-1.5`}
        />
        <button
          type="button"
          disabled={busy === 'forceUpdate'}
          onClick={() =>
            save(
              'forceUpdate',
              forceUpdate,
              forceUpdate.enabled
                ? `${forceUpdate.minVersion || '(빈 버전)'} 미만 앱을 전부 막을까요? 스토어에 그 버전이 올라가 있는지 먼저 확인하세요.`
                : undefined
            )
          }
          className={`${button} mt-3`}
        >
          {busy === 'forceUpdate' ? '저장 중…' : '강제 업데이트 저장'}
        </button>
        {saved === 'forceUpdate' ? (
          <p role="status" className="mt-2 text-[13px] text-positive">
            저장됐어요.
          </p>
        ) : null}
      </Panel>

      <Panel
        title="금지어"
        description="글과 댓글 작성 시 이 단어가 들어 있으면 거부돼요. 한 줄에 하나씩, 대소문자는 구분하지 않아요."
      >
        <label htmlFor="banned-words" className="sr-only-label">
          금지어 목록
        </label>
        <textarea
          id="banned-words"
          value={bannedWords}
          onChange={(e) => setBannedWords(e.target.value)}
          rows={8}
          className={area}
        />
        <p className="mt-1.5 text-[12.5px] text-muted">{toList(bannedWords).length}개</p>
        <button
          type="button"
          disabled={busy === 'bannedWords'}
          onClick={() => save('bannedWords', toList(bannedWords))}
          className={`${button} mt-3`}
        >
          {busy === 'bannedWords' ? '저장 중…' : '금지어 저장'}
        </button>
        {saved === 'bannedWords' ? (
          <p role="status" className="mt-2 text-[13px] text-positive">
            저장됐어요.
          </p>
        ) : null}
      </Panel>

      <Panel
        title="IP 차단"
        description="이 IP에서 오는 모든 요청이 403을 받아요. 한 줄에 하나씩. 공용 와이파이처럼 여러 사람이 쓰는 주소는 함께 막히니 주의하세요."
      >
        <label htmlFor="blocked-ips" className="sr-only-label">
          차단 IP 목록
        </label>
        <textarea
          id="blocked-ips"
          value={blockedIps}
          onChange={(e) => setBlockedIps(e.target.value)}
          rows={6}
          className={area}
        />
        <p className="mt-1.5 text-[12.5px] text-muted">{toList(blockedIps).length}개</p>
        <button
          type="button"
          disabled={busy === 'blockedIps'}
          onClick={() =>
            save(
              'blockedIps',
              toList(blockedIps),
              '이 목록으로 IP 차단을 저장할까요? 본인 IP가 들어 있으면 스스로도 막혀요.'
            )
          }
          className={`${button} mt-3`}
        >
          {busy === 'blockedIps' ? '저장 중…' : 'IP 차단 저장'}
        </button>
        {saved === 'blockedIps' ? (
          <p role="status" className="mt-2 text-[13px] text-positive">
            저장됐어요.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
