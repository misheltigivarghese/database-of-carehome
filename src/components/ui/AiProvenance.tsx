import { Sparkles, TriangleAlert } from "lucide-react";
import type { Confidence, ReviewFlag } from "../../types";
import { CONFIDENCE_LABEL } from "../../types";
import { cn } from "../../lib/utils";
import { Badge } from "./Badge";

/**
 * The persistent "this came from a model" affordance. Every AI surface carries
 * it — the healthcare track requires that uncertainty stays visible and that a
 * human decides what to do.
 */
export function AiProvenance({ model, className }: { model?: string | null; className?: string }) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 font-medium text-primary">
        <Sparkles aria-hidden="true" className="size-3.5" />
        AI-assisted — verify before acting
      </span>
      {model ? (
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem]">
          {model}
        </span>
      ) : null}
    </p>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const tone = confidence === "low" ? "warning" : confidence === "medium" ? "info" : "success";
  return (
    <Badge tone={tone} className="font-normal">
      {CONFIDENCE_LABEL[confidence]}
    </Badge>
  );
}

const SEVERITY_TONE = {
  info: "info",
  warning: "warning",
  critical: "danger",
} as const;

export function ReviewFlagList({ flags }: { flags: ReviewFlag[] }) {
  if (flags.length === 0) return null;

  return (
    <ul className="space-y-2">
      {flags.map((flag, index) => (
        <li
          key={`${flag.label}-${index}`}
          className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
        >
          <TriangleAlert
            aria-hidden="true"
            className={cn(
              "mt-0.5 size-4 shrink-0",
              flag.severity === "critical" ? "text-destructive" : "text-warning",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{flag.label}</p>
              <Badge tone={SEVERITY_TONE[flag.severity]} className="capitalize">
                {flag.severity}
              </Badge>
            </div>
            {flag.detail ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{flag.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function reviewSummary(count: number): string {
  if (count === 0) return "Nothing flagged for review.";
  return `${count} item${count === 1 ? "" : "s"} flagged for human review.`;
}
