import * as React from "react";
import { AlertCircle } from "lucide-react";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  /** Hide the visual label but keep it for screen readers. */
  labelHidden?: boolean;
};

export function Field({
  label,
  error,
  hint,
  labelHidden = false,
  id,
  className = "",
  ...rest
}: FieldProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={
          labelHidden
            ? "sr-only"
            : "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-strong"
        }
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="field"
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-danger"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
