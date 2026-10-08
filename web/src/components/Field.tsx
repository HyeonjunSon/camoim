export default function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13.5px] font-semibold text-ink-3">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  'h-12 w-full rounded-control border border-line-strong bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-brand-strong';

export const buttonClass =
  'flex h-12 w-full items-center justify-center rounded-control bg-brand-strong text-base font-semibold text-white hover:bg-brand-ink-hover disabled:cursor-not-allowed disabled:opacity-55';
