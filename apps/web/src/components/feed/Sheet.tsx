'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Accessible bottom sheet built on <dialog> (focus trap, Escape to close). */
export function Sheet({
  open,
  title,
  onClose,
  closeLabel,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="mb-0 mt-auto max-h-[80dvh] w-full max-w-lg rounded-t-2xl border border-line bg-panel p-0 text-white backdrop:bg-black/60 sm:m-auto sm:rounded-2xl"
    >
      <div className="flex max-h-[80dvh] flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="sheet-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-11 w-11 items-center justify-center text-2xl"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
