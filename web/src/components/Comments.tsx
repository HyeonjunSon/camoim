'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CommentNode } from '@/lib/types';
import { initial, timeAgo } from '@/lib/format';
import ReportButton from './ReportButton';

type Props = {
  postId: string;
  initialComments: CommentNode[];
  signedIn: boolean;
  myUserId: string | null;
  /** The board forces anonymity; the writer has no say in it. */
  anonymousBoard: boolean;
};

const AVATAR_TONES = [
  ['#EEF2FF', '#4338CA'],
  ['#FFEDD5', '#C2410C'],
  ['#D1FAE5', '#047857'],
  ['#FCE7F3', '#BE185D'],
  ['#DBEAFE', '#1D4ED8'],
] as const;

function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function countAll(nodes: CommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + n.replies.length, 0);
}

export default function Comments({
  postId,
  initialComments,
  signedIn,
  myUserId,
  anonymousBoard,
}: Props) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [secret, setSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const res = await fetch(`/api/bff/posts/${postId}/comments`);
    const json = await res.json();
    if (json?.success) setComments(json.data as CommentNode[]);
  }

  async function submit(content: string, parentId: string | null, isSecret: boolean) {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/posts/${postId}`)}`);
      return;
    }
    const text = content.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, parentId, isSecret }),
      });
      const json = await res.json();
      // The server rejects banned words with its own message; show it verbatim.
      if (!res.ok || !json.success) throw new Error(json.message || '댓글을 남기지 못했어요.');
      if (parentId) {
        setReplyDraft('');
        setReplyTo(null);
      } else {
        setDraft('');
        setSecret(false);
      }
      await reload();
      // Keeps the post's comment count in the server-rendered header honest.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '댓글을 남기지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: string) {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '삭제하지 못했어요.');
      await reload();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  function renderNode(node: CommentNode, depth: number) {
    const mine = !!myUserId && node.userId === myUserId;
    const [bg, fg] = toneFor(node.nickname ?? node.id);

    return (
      <li key={node.id}>
        <div
          className="flex gap-3 border-b border-line-faint py-4"
          style={{ paddingLeft: depth > 0 ? 48 : 0 }}
        >
          {node.isSecretMasked ? (
            <p className="text-sm text-muted">🔒 비밀 댓글이에요. 작성자와 글쓴이만 볼 수 있어요.</p>
          ) : (
            <>
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: bg, color: fg }}
              >
                {initial(node.nickname)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-semibold">{node.nickname}</span>
                  {node.isPinned ? (
                    <span className="rounded-[5px] bg-brand-tint px-1.5 py-0.5 text-[11.5px] font-bold text-brand-ink-hover">
                      고정
                    </span>
                  ) : null}
                  {node.isSecret ? <span className="text-[12px] text-muted">🔒 비밀</span> : null}
                  <span className="text-[12.5px] text-muted">
                    {timeAgo(node.createdAt)}
                    {node.edited ? ' · 수정됨' : ''}
                  </span>
                </div>
                <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                  {node.content}
                </p>
                <div className="mt-1.5 flex gap-3.5 text-[13px] text-muted">
                  {depth === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(replyTo === node.id ? null : node.id);
                        setReplyDraft('');
                      }}
                      className="hover:text-ink-3"
                    >
                      답글
                    </button>
                  ) : null}
                  {mine ? (
                    <button
                      type="button"
                      onClick={() => remove(node.id)}
                      disabled={busy}
                      className="hover:text-danger"
                    >
                      삭제
                    </button>
                  ) : (
                    <ReportButton
                      targetType="comment"
                      targetId={node.id}
                      postId={postId}
                      signedIn={signedIn}
                    />
                  )}
                </div>

                {replyTo === node.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit(replyDraft, node.id, false);
                    }}
                    className="mt-2.5 flex gap-2"
                  >
                    <label htmlFor={`reply-${node.id}`} className="sr-only-label">
                      답글 입력
                    </label>
                    <input
                      id={`reply-${node.id}`}
                      autoFocus
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="답글을 남겨주세요"
                      className="h-11 min-w-0 flex-1 rounded-control border border-line-strong px-3.5 text-[15px] outline-none focus:border-brand-strong"
                    />
                    <button
                      type="submit"
                      disabled={busy || !replyDraft.trim()}
                      className="h-11 shrink-0 rounded-control bg-brand-strong px-4 text-sm font-semibold text-white disabled:opacity-55"
                    >
                      등록
                    </button>
                  </form>
                ) : null}
              </div>
            </>
          )}
        </div>
        {node.replies.length > 0 ? (
          <ul>{node.replies.map((child) => renderNode(child, depth + 1))}</ul>
        ) : null}
      </li>
    );
  }

  return (
    <section
      id="comments"
      className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-7"
    >
      <h2 className="text-[17px] font-bold">댓글 {countAll(comments)}</h2>

      {comments.length === 0 ? (
        <p className="pt-2 pb-1 text-sm text-muted">아직 댓글이 없어요. 첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="mt-1.5">{comments.map((node) => renderNode(node, 0))}</ul>
      )}

      {signedIn ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft, null, secret);
          }}
          className="mt-4 rounded-[14px] border border-transparent bg-field px-4 pt-3 pb-2.5 transition-colors focus-within:border-brand-strong focus-within:bg-surface"
        >
          <label htmlFor="comment" className="sr-only-label">
            댓글 입력
          </label>
          <textarea
            id="comment"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={secret ? '비밀 댓글은 글쓴이만 볼 수 있어요' : '댓글을 남겨주세요'}
            rows={2}
            className="block w-full resize-none border-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted"
          />
          <div className="mt-1.5 flex items-center justify-between gap-3">
            {anonymousBoard ? (
              <span className="text-[13px] text-muted">익명으로 등록돼요</span>
            ) : (
              <button
                type="button"
                onClick={() => setSecret((v) => !v)}
                aria-pressed={secret}
                title="글쓴이만 볼 수 있어요"
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors ${
                  secret
                    ? 'bg-brand-tint text-brand-ink-hover'
                    : 'text-muted hover:bg-shade hover:text-ink-3'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d={secret ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.7-1.5'} />
                </svg>
                비밀 댓글
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="h-9 shrink-0 rounded-full bg-brand-strong px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-ink-hover disabled:bg-shade disabled:text-muted"
            >
              {busy ? '등록 중…' : '등록'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-[14px] border border-line-strong px-3.5 py-4 text-sm text-muted">
          댓글을 남기려면{' '}
          <a
            href={`/login?next=${encodeURIComponent(`/posts/${postId}`)}`}
            className="font-semibold text-brand-ink hover:text-brand-ink-hover"
          >
            로그인
          </a>
          이 필요해요.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
