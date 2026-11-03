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
      className="m-auto rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-modal-zoom"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-[85vw] max-w-[360px] p-5 animate-modal-zoom">
        <h2 id="confirm-dialog-title" className="font-display text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="focus-ring rounded-xl border border-border px-3.5 py-1.5 text-sm hover:bg-muted hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              handleClose();
            }}
            className={`focus-ring rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm ${
              danger
                ? "bg-offline text-white hover:bg-offline/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
