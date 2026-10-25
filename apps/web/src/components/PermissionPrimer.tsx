'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui';

/**
 * Explanation shown BEFORE any system permission prompt (camera, microphone, location,
 * notifications). Rendered as an accessible modal dialog.
 */
export function PermissionPrimer({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="primer-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-line bg-panel p-5 text-white backdrop:bg-black/70"
    >
      <h2 id="primer-title" className="mb-3 text-xl font-bold">
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-sm text-fog">{children}</div>
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={onConfirm} autoFocus>
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}
