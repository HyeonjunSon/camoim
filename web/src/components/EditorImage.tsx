'use client';

import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';

/**
 * The editor's image, with a remove button once it is clicked (selected).
 * Backspace was the only way to delete one, which nobody finds on their own.
 *
 * This only changes how the image looks while editing — `renderHTML` is the
 * stock extension's, so the saved post is still a bare <img> the app's pell
 * editor and the post page already understand.
 */
function ImageView({ node, selected, deleteNode }: ReactNodeViewProps) {
  const { src, alt, title } = node.attrs as { src: string; alt?: string; title?: string };
  return (
    <NodeViewWrapper className="relative my-2 block w-fit max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- editor content, not a page image */}
      <img
        src={src}
        alt={alt ?? ''}
        title={title}
        className={`block max-w-full rounded-lg ${selected ? 'outline-3 outline-offset-2 outline-brand-strong' : ''}`}
      />
      {selected ? (
        <button
          type="button"
          aria-label="이미지 삭제"
          title="이미지 삭제"
          // mousedown, not click: keep ProseMirror from moving the selection
          // off the image before the delete runs.
          onMouseDown={(e) => {
            e.preventDefault();
            deleteNode();
          }}
          className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </NodeViewWrapper>
  );
}

export const EditorImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
