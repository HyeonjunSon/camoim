'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GroupMember } from '@/lib/types';
import { initial, timeAgo } from '@/lib/format';
import { useLang, useMessages } from '@/lib/i18n/client';

export default function GroupMemberList({
  groupId,
  members,
  pending,
  canManage,
  isOwner,
  myUserId,
}: {
  groupId: string;
  members: GroupMember[];
  pending: GroupMember[];
  canManage: boolean;
  isOwner: boolean;
  myUserId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const all = useMessages();
  const m = all.group;
  const lang = useLang();

  async function act(userId: string, path: string, method: 'PUT' | 'DELETE', body?: unknown) {
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch(`/api/bff/groups/${groupId}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || all.common.failed);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : all.common.failed);
    } finally {
      setBusy(null);
    }
  }

  function Row({ member, isPending }: { member: GroupMember; isPending: boolean }) {
    const working = busy === member.id;
    const me = member.id === myUserId;

    return (
      <li className="flex flex-wrap items-center gap-3 border-b border-line-faint px-5 py-3.5 last:border-b-0">
        {member.avatarUrl ? (
          <Image
            src={member.avatarUrl}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint font-bold text-brand-ink"
          >
            {initial(member.nickname)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/users/${member.id}`}
              className="truncate text-[15px] font-semibold text-ink hover:underline"
            >
              {member.nickname}
            </Link>
            {!isPending ? (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ${
                  member.role === 'owner'
                    ? 'bg-brand-tint text-brand-ink-hover'
                    : member.role === 'manager'
                      ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                      : 'bg-field text-ink-3'
                }`}
              >
                {m.roles[member.role]}
              </span>
            ) : null}
            {member.verified && member.university ? (
              <span className="text-[11.5px] text-muted">{member.university}</span>
            ) : null}
          </div>
          <p className="text-[12.5px] text-muted">{m.joinedAgo(timeAgo(member.joinedAt, undefined, lang))}</p>
        </div>

        {canManage && !me ? (
          <div className="flex flex-wrap gap-1.5">
            {isPending ? (
              <>
                <button
                  type="button"
                  onClick={() => act(member.id, `/members/${member.id}/approve`, 'PUT')}
                  disabled={working}
                  className="h-9 rounded-control bg-brand-strong px-3 text-sm font-semibold text-white disabled:opacity-55"
                >
                  {m.approve}
                </button>
                <button
                  type="button"
                  onClick={() => act(member.id, `/members/${member.id}/reject`, 'DELETE')}
                  disabled={working}
                  className="h-9 rounded-control border border-line-strong px-3 text-sm font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
                >
                  {m.reject}
                </button>
              </>
            ) : member.role !== 'owner' ? (
              <>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() =>
                      act(member.id, `/members/${member.id}/role`, 'PUT', {
                        role: member.role === 'manager' ? 'member' : 'manager',
                      })
                    }
                    disabled={working}
                    className="h-9 rounded-control border border-line-strong px-3 text-sm font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
                  >
                    {member.role === 'manager' ? m.unsetManager : m.setManager}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(m.kickConfirm(member.nickname))) return;
                    act(member.id, `/members/${member.id}`, 'DELETE');
                  }}
                  disabled={working}
                  className="h-9 rounded-control px-3 text-sm font-semibold text-muted hover:bg-field hover:text-danger disabled:opacity-55"
                >
                  {m.kick}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      {canManage && pending.length > 0 ? (
        <section className="mb-5">
          <h2 className="text-lg font-bold">{m.pending(pending.length)}</h2>
          <ul className="mt-3 overflow-hidden rounded-card border border-line-soft bg-surface">
            {pending.map((m) => (
              <Row key={m.id} member={m} isPending />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-bold">{m.memberCount(members.length)}</h2>
        <ul className="mt-3 overflow-hidden rounded-card border border-line-soft bg-surface">
          {members.map((m) => (
            <Row key={m.id} member={m} isPending={false} />
          ))}
        </ul>
      </section>
    </>
  );
}
