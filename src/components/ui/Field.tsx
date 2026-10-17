import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";

export const controlClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 transition-colors duration-150 ease-out " +
  "hover:border-primary/45 focus:border-primary " +
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70";

interface FieldExtras {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
}

type TextFieldProps = FieldExtras &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & { className?: string };

export function TextField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  required,
  ...rest
}: TextFieldProps) {
  if (!id) throw new Error("TextField requires an id so its label can be associated.");
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-sm font-medium text-foreground">
        {label}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        ) : null}
      </label>
      <input
        {...rest}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(controlClass, error && "border-destructive", className)}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextAreaFieldProps = FieldExtras &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & { className?: string };

export function TextAreaField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  required,
  rows = 4,
  ...rest
}: TextAreaFieldProps) {
  if (!id) throw new Error("TextAreaField requires an id so its label can be associated.");
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-sm font-medium text-foreground">
        {label}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        ) : null}
      </label>
      <textarea
        {...rest}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(controlClass, "resize-y", error && "border-destructive", className)}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
