"use client";

import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook to standardize server action form submissions across the codebase.
 * Handles loading state, error display, success callbacks, and refresh.
 *
 * Usage:
 * ```tsx
 * const { execute, isLoading } = useActionForm({
 *   onSuccess: () => { setOpen(false); router.refresh(); },
 *   successMessage: "Record created successfully",
 * });
 *
 * // In submit handler:
 * await execute(() => createRecordAction(formData));
 * ```
 */
export function useActionForm(options?: {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  successMessage?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async <T>(
      action: () => Promise<{ error: string } | T>,
    ): Promise<T | null> => {
      setError(null);
      return new Promise((resolve) => {
        startTransition(async () => {
          try {
            const result = await action();
            if (result && typeof result === "object" && "error" in result) {
              const errMsg = (result as { error: string }).error;
              setError(errMsg);
              if (options?.onError) {
                options.onError(errMsg);
              } else {
                toast.error(errMsg);
              }
              resolve(null);
              return;
            }
            if (options?.successMessage) {
              toast.success(options.successMessage);
            }
            options?.onSuccess?.();
            resolve(result as T);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
            setError(errMsg);
            toast.error(errMsg);
            resolve(null);
          }
        });
      });
    },
    [options],
  );

  return {
    execute,
    isLoading: isPending,
    error,
    setError,
    clearError: () => setError(null),
  };
}
