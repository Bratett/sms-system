"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  trigger: React.ReactNode;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  trigger,
  variant = "default",
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the dialog
    const timer = setTimeout(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        "button, [tabindex]:not([tabindex='-1'])"
      );
      firstFocusable?.focus();
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        setOpen(false);
        return;
      }
      // Trap focus within dialog
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [tabindex]:not([tabindex='-1'])"
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, loading]);

  const handleClose = useCallback(() => {
    if (!loading) setOpen(false);
  }, [loading]);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-desc"
        >
          <div
            className="fixed inset-0"
            onClick={handleClose}
            aria-hidden="true"
          />
          <div
            ref={dialogRef}
            className="relative z-10 w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
          >
            <h3 id="confirm-dialog-title" className="text-lg font-semibold">
              {title}
            </h3>
            <p id="confirm-dialog-desc" className="mt-2 text-sm text-muted-foreground">
              {description}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  variant === "destructive"
                    ? "bg-destructive hover:bg-destructive/90 focus:ring-destructive"
                    : "bg-primary hover:bg-primary/90 focus:ring-primary"
                } disabled:opacity-50`}
              >
                {loading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
