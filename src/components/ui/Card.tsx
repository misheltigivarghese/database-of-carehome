import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section";
}

export function Card({ as = "section", className, children, ...rest }: CardProps) {
  const Tag = as;
  return (
    <Tag
      {...rest}
      className={cn(
        "rounded-card border border-border bg-surface shadow-card",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, description, action, icon }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <span aria-hidden="true" className="mt-0.5 text-muted-foreground">
            {icon}
          </span>
        ) : null}
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("px-5 py-4", className)}>
      {children}
    </div>
  );
}
