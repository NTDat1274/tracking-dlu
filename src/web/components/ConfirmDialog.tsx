// src/web/components/ConfirmDialog.tsx
import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerElRef = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      triggerElRef.current = document.activeElement;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    onCancel();
    requestAnimationFrame(() => {
      if (triggerElRef.current instanceof HTMLElement) {
        triggerElRef.current.focus();
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="m-auto rounded-lg border border-border bg-card p-0 shadow-xl backdrop:bg-black/40"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-[85vw] max-w-[360px] p-5">
        <h2 id="confirm-dialog-title" className="font-display text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="focus-ring rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              handleClose();
            }}
            className={`focus-ring rounded-md px-3 py-1.5 text-sm font-medium text-white ${danger ? "bg-offline hover:bg-red-700" : "bg-primary hover:bg-blue-700"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
