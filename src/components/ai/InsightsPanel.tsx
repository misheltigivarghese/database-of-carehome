import { FileSearch, Sparkles } from "lucide-react";

import type { DocInsight } from "../../types";
import { formatDateTime, relativeTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import { AiProvenance, ConfidenceBadge, ReviewFlagList, reviewSummary } from "../ui/AiProvenance";
import { Badge } from "../ui/Badge";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { LoadingPanel } from "../ui/Spinner";

interface InsightsPanelProps {
  insights: DocInsight[];
  loading: boolean;
}

export function InsightsPanel({ insights, loading }: InsightsPanelProps) {
  const needsReview = insights.reduce(
    (total, insight) =>
      total + insight.reviewFlags.length + insight.extracted.fields.filter((f) => f.needs_review).length,
    0,
  );

  return (
    <Card>
      <CardHeader
        title="Care-plan extraction"
        description="What the AI read out of this resident's documents — with its confidence, and what a person still has to confirm."
        icon={<FileSearch aria-hidden="true" className="size-4" />}
        action={
          insights.length > 0 ? (
            needsReview > 0 ? (
              <Badge tone="warning">{needsReview} to review</Badge>
            ) : (
              <Badge tone="success">Nothing flagged</Badge>
            )
          ) : undefined
        }
      />

      <CardBody className="space-y-4">
        {loading ? (
          <LoadingPanel label="Loading extractions…" />
        ) : insights.length === 0 ? (
          <EmptyState
            icon={<Sparkles aria-hidden="true" className="size-5" />}
            title="No documents analysed yet"
            description="Open the Documents tab, upload a care plan, then choose Analyse. The extracted conditions, medications and dietary needs will appear here, each with a confidence level."
          />
        ) : (
          insights.map((insight) => (
            <article key={insight.id} className="rounded-card border border-border bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {insight.documentName || "Care-plan document"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={insight.createdAt} title={formatDateTime(insight.createdAt)}>
                      {relativeTime(insight.createdAt)}
                    </time>
                  </p>
                </div>
                {insight.reviewFlags.length > 0 ? (
                  <Badge tone="warning">{reviewSummary(insight.reviewFlags.length)}</Badge>
                ) : (
                  <Badge tone="success">Nothing flagged</Badge>
                )}
              </header>

              <div className="space-y-4 px-4 py-4">
                {insight.summary ? (
                  <div>
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Plain-language summary
                    </h4>
                    <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                      {insight.summary}
                    </p>
                  </div>
                ) : null}

                {insight.extracted.fields.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Extracted details
                    </h4>
                    <dl className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
                      {insight.extracted.fields.map((field, index) => (
                        <div
                          key={`${field.label}-${index}`}
                          className={cn(
                            "flex flex-wrap items-start gap-x-4 gap-y-1 px-3.5 py-2.5",
                            field.needs_review && "bg-warning-soft/60",
                          )}
                        >
                          <dt className="w-40 shrink-0 text-sm font-medium text-muted-foreground">
                            {field.label}
                          </dt>
                          <dd className="min-w-0 flex-1">
                            <p className="text-sm text-foreground">{field.value}</p>
                          </dd>
                          <div className="flex shrink-0 items-center gap-2">
                            <ConfidenceBadge confidence={field.confidence} />
                            {field.needs_review ? <Badge tone="warning">Review</Badge> : null}
                          </div>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No structured fields were extracted from this document.
                  </p>
                )}

                {insight.extracted.gaps.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Couldn't be read
                    </h4>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {insight.extracted.gaps.map((gap, index) => (
                        <li key={`${gap}-${index}`}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {insight.reviewFlags.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Needs a person to check
                    </h4>
                    <div className="mt-2">
                      <ReviewFlagList flags={insight.reviewFlags} />
                    </div>
                  </div>
                ) : null}

                <AiProvenance model={insight.model} />
              </div>
            </article>
          ))
        )}
      </CardBody>
    </Card>
  );
}
