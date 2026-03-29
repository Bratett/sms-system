"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// ── FormLabel ─────────────────────────────────────────────────

interface FormLabelProps {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormLabel({ htmlFor, required, children, className }: FormLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("mb-1.5 block text-sm font-medium text-foreground", className)}
    >
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

// ── FormError ─────────────────────────────────────────────────

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[13px] text-destructive">{message}</p>;
}

// ── FormDescription ───────────────────────────────────────────

export function FormDescription({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[13px] text-muted-foreground">{children}</p>;
}

// ── FormInput ─────────────────────────────────────────────────

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  description?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, description, required, id, className, ...props }, ref) => {
    return (
      <div>
        {label && (
          <FormLabel htmlFor={id} required={required}>
            {label}
          </FormLabel>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          className={cn(
            "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        {description && !error && <FormDescription>{description}</FormDescription>}
        {error && <FormError message={error} />}
      </div>
    );
  },
);
FormInput.displayName = "FormInput";

// ── FormSelect ────────────────────────────────────────────────

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  description?: string;
  options: { label: string; value: string }[];
  placeholder?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, description, required, id, options, placeholder, className, ...props }, ref) => {
    return (
      <div>
        {label && (
          <FormLabel htmlFor={id} required={required}>
            {label}
          </FormLabel>
        )}
        <select
          ref={ref}
          id={id}
          required={required}
          className={cn(
            "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          aria-invalid={!!error}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {description && !error && <FormDescription>{description}</FormDescription>}
        {error && <FormError message={error} />}
      </div>
    );
  },
);
FormSelect.displayName = "FormSelect";

// ── FormTextarea ──────────────────────────────────────────────

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  description?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, description, required, id, className, ...props }, ref) => {
    return (
      <div>
        {label && (
          <FormLabel htmlFor={id} required={required}>
            {label}
          </FormLabel>
        )}
        <textarea
          ref={ref}
          id={id}
          required={required}
          className={cn(
            "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
        {description && !error && <FormDescription>{description}</FormDescription>}
        {error && <FormError message={error} />}
      </div>
    );
  },
);
FormTextarea.displayName = "FormTextarea";
