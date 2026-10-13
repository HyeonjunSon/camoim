'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BlockEntry } from '@/lib/types';
import { initial } from '@/lib/format';

export default function BlockList({ initialBlocks }: { initialBlocks: BlockEntry[] }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initialBlocks);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unblock(userId: string, nickname: string) {
    if (!window.confirm(`${nickname}님의 차단을 해제할까요?`)) return;
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch(`/api/bff/users/${userId}/block`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '해제하지 못했어요.');
      setBlocks((prev) => prev.filter((b) => b.blockedId !== userId));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '해제하지 못했어요.');
    } finally {
      setBusy(null);
    }
  }

  if (blocks.length === 0) {
    return (
      <p className="rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
        차단한 회원이 없어요.
      </p>
    );
  }

  return (
    <>
      <ul className="overflow-hidden rounded-card border border-line-soft bg-surface">
        {blocks.map((block) => (
          <li
            key={block.id}
            className="flex items-center gap-3 border-b border-line-faint px-5 py-3.5 last:border-b-0"
          >
            {block.avatarUrl ? (
              <Image
                src={block.avatarUrl}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-field font-bold text-ink-3"
              >
                {initial(block.nickname)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Link
                href={`/users/${block.blockedId}`}
                className="block truncate text-[15px] font-semibold text-ink hover:underline"
              >
                {block.nickname ?? '알 수 없음'}
              </Link>
              <p className="text-[12.5px] text-muted">
                {[block.hideContent ? '글·댓글 숨김' : null, block.blockChat ? '채팅 차단' : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => unblock(block.blockedId, block.nickname ?? '이 회원')}
              disabled={busy === block.blockedId}
              className="h-10 shrink-0 rounded-control border border-line-strong px-3 text-sm font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
            >
              해제
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </>
  );
}
