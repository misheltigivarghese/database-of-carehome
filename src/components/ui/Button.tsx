import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Shared press/transition behaviour. `motion-safe:` gates the press-scale so
 * reduced-motion users get colour feedback without movement.
 */
const BASE =
  "inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap " +
  "cursor-pointer transition-[background-color,color,box-shadow,opacity] duration-150 ease-out " +
  "motion-safe:active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-55";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary border border-transparent hover:bg-primary-hover shadow-card",
  secondary: "bg-surface text-foreground border border-border-strong hover:bg-muted",
  ghost:
    "bg-transparent text-muted-foreground border border-transparent hover:bg-muted hover:text-foreground",
  danger: "bg-destructive text-white border border-transparent hover:opacity-90",
};

const PADDED_SIZES = {
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
} as const;

const SQUARE_SIZES = {
  sm: "size-8 text-[0.8125rem]",
  md: "size-10 text-sm",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof PADDED_SIZES;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], PADDED_SIZES[size], className)}
    >
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon-only controls have no visible text, so a label is mandatory. */
  label: string;
  icon: ReactNode;
  variant?: Variant;
  size?: keyof typeof SQUARE_SIZES;
}

export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "sm",
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={cn(BASE, VARIANTS[variant], SQUARE_SIZES[size], "shrink-0", className)}
    >
      {icon}
    </button>
  );
}
