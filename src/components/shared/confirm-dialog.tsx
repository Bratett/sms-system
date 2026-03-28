"use client";

import { useState } from "react";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  variant === "destructive"
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-primary hover:bg-primary/90"
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
