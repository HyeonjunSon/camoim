'use client';

import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import { useRef, useState } from 'react';

/**
 * The toolbar is deliberately the same set the app's pell editor exposes —
 * image, bold, italic, underline, H2, align — so a post written on one client
 * renders unchanged on the other. Adding a mark here that pell cannot produce
 * would show up as unstyled text on a phone.
 */
export default function PostEditor({
  initialHtml,
  onChange,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    // Rendered on the client only; the server has no DOM to measure against.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        // pell has no code block, horizontal rule or blockquote button, so a
        // post using them would look foreign in the app.
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
      }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['paragraph', 'heading'] }),
      Placeholder.configure({ placeholder: '내용을 입력해주세요' }),
    ],
    content: initialHtml || '',
    editorProps: {
      attributes: {
        class: 'post-body min-h-[320px] px-4 py-3.5 outline-none',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch('/api/upload/image', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '업로드에 실패했어요.');
      editor?.chain().focus().setImage({ src: json.data.url }).run();
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했어요.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!editor) {
    return <div className="h-[380px] animate-pulse rounded-control bg-shade" />;
  }

  return (
    <div className="overflow-hidden rounded-control border border-line-strong bg-surface focus-within:border-brand-strong">
      <div className="flex flex-wrap items-center gap-1 border-b border-line-faint px-2 py-1.5">
        <ToolButton
          label="이미지 넣기"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m21 16-5-5-9 9" />
          </svg>
        </ToolButton>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />

        <Divider />
        <MarkButton editor={editor} mark="bold" label="굵게">
          <span className="text-[15px] font-bold">B</span>
        </MarkButton>
        <MarkButton editor={editor} mark="italic" label="기울임">
          <span className="font-serif text-[15px] italic">I</span>
        </MarkButton>
        <MarkButton editor={editor} mark="underline" label="밑줄">
          <span className="text-[15px] underline">U</span>
        </MarkButton>

        <Divider />
        <ToolButton
          label="제목"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <span className="text-[15px] font-bold">H</span>
        </ToolButton>

        <Divider />
        {(['left', 'center', 'right'] as const).map((align) => (
          <ToolButton
            key={align}
            label={align === 'left' ? '왼쪽 정렬' : align === 'center' ? '가운데 정렬' : '오른쪽 정렬'}
            active={editor.isActive({ textAlign: align })}
            onClick={() => editor.chain().focus().setTextAlign(align).run()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4 6h16" />
              <path d={align === 'left' ? 'M4 12h10' : align === 'center' ? 'M7 12h10' : 'M10 12h10'} />
              <path d="M4 18h16" />
            </svg>
          </ToolButton>
        ))}

        <Divider />
        <ToolButton label="실행 취소" onClick={() => editor.chain().focus().undo().run()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
          </svg>
        </ToolButton>
        <ToolButton label="다시 실행" onClick={() => editor.chain().focus().redo().run()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H9a5 5 0 0 0 0 10h3" />
          </svg>
        </ToolButton>

        {uploading ? <span className="ml-1 text-[13px] text-muted">이미지 올리는 중…</span> : null}
      </div>

      <EditorContent editor={editor} />

      {error ? (
        <p role="alert" className="border-t border-line-faint bg-[#FEF2F2] px-4 py-2.5 text-[13px] text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-line-faint" />;
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex size-9 items-center justify-center rounded-lg disabled:opacity-45 ${
        active ? 'bg-brand-tint text-brand-ink-hover' : 'text-ink-3 hover:bg-field'
      }`}
    >
      {children}
    </button>
  );
}

function MarkButton({
  editor,
  mark,
  label,
  children,
}: {
  editor: Editor;
  mark: 'bold' | 'italic' | 'underline';
  label: string;
  children: React.ReactNode;
}) {
  return (
    <ToolButton
      label={label}
      active={editor.isActive(mark)}
      onClick={() => {
        const chain = editor.chain().focus();
        if (mark === 'bold') chain.toggleBold().run();
        else if (mark === 'italic') chain.toggleItalic().run();
        else chain.toggleUnderline().run();
      }}
    >
      {children}
    </ToolButton>
  );
}
