import { useState } from "react";
import { ClipboardList, Sparkles } from "lucide-react";

import { generateHandover } from "../../lib/ai";
import { formatDateTime, relativeTime } from "../../lib/format";
import type { HandoverSummary } from "../../types";
import { AiProvenance, ReviewFlagList, reviewSummary } from "../ui/AiProvenance";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { LoadingPanel } from "../ui/Spinner";
import { useToast } from "../ui/Toast";

interface HandoverPanelProps {
  residentId: string;
  residentName: string;
  noteCount: number;
  handovers: HandoverSummary[];
  loading: boolean;
  onGenerated: () => void;
}

export function HandoverPanel({
  residentId,
  residentName,
  noteCount,
  handovers,
  loading,
  onGenerated,
}: HandoverPanelProps) {
  const toast = useToast();
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const latest = handovers[0] ?? null;

  async function handleGenerate() {
    setGenerating(true);
    const result = await generateHandover(residentId, 12);
    setGenerating(false);

    if (result.error || !result.data) {
      toast.error("Handover brief not generated", result.error ?? undefined);
      return;
    }

    const flagged = result.data.reviewFlags.length;
    toast.success(
      "Handover brief ready",
      flagged === 0
        ? "Nothing flagged — read it before the shift starts."
        : `${flagged} concern${flagged === 1 ? "" : "s"} flagged for a person to check.`,
    );
    setExpandedId(result.data.id);
    onGenerated();
  }

  return (
    <Card>
      <CardHeader
        title="Shift-handover brief"
        description={`Summarises the most recent care notes for ${residentName}.`}
        icon={<ClipboardList aria-hidden="true" className="size-4" />}
        action={
          <Button
            size="sm"
            loading={generating}
            disabled={noteCount === 0}
            icon={<Sparkles aria-hidden="true" className="size-3.5" />}
            onClick={() => void handleGenerate()}
          >
            {latest ? "Generate again" : "Generate brief"}
          </Button>
        }
      />

      <CardBody className="space-y-4">
        {noteCount === 0 ? (
          <EmptyState
            icon={<ClipboardList aria-hidden="true" className="size-5" />}
            title="Nothing to summarise yet"
            description={`The handover brief is built from care notes. Add a few notes about ${residentName}, then generate it here.`}
          />
        ) : loading ? (
          <LoadingPanel label="Loading handover history…" />
        ) : !latest ? (
          <EmptyState
            icon={<Sparkles aria-hidden="true" className="size-5" />}
            title={`${noteCount} note${noteCount === 1 ? "" : "s"} ready to summarise`}
            description="Generate a brief and the AI will condense the recent notes into what the next shift needs, flagging anything that needs a person to check."
          />
        ) : (
          <>
            <div className="rounded-card border border-primary/25 bg-primary/5 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="info">Latest brief</Badge>
                  <span className="text-xs text-muted-foreground">
                    <time dateTime={latest.createdAt} title={formatDateTime(latest.createdAt)}>
                      {relativeTime(latest.createdAt)}
                    </time>
                  </span>
                </div>
                {latest.reviewFlags.length > 0 ? (
                  <Badge tone="warning">
                    {reviewSummary(latest.reviewFlags.length)}
                  </Badge>
                ) : (
                  <Badge tone="success">Nothing flagged</Badge>
                )}
              </div>

              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {latest.summary}
              </p>

              <AiProvenance model={latest.model} className="mt-3" />
            </div>

            {latest.reviewFlags.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Check these before the shift starts
                </h4>
                <ReviewFlagList flags={latest.reviewFlags} />
              </div>
            ) : null}

            {handovers.length > 1 ? (
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-primary transition-colors duration-150 hover:underline">
                  Earlier briefs ({handovers.length - 1})
                </summary>
                <ul className="mt-3 space-y-2">
                  {handovers.slice(1).map((entry) => {
                    const open = expandedId === entry.id;
                    return (
                      <li key={entry.id} className="rounded-card border border-border bg-surface">
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : entry.id)}
                          aria-expanded={open}
                          className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50"
                        >
                          <span className="text-sm text-foreground">
                            {formatDateTime(entry.createdAt)}
                          </span>
                          <span className="flex items-center gap-2">
                            {entry.reviewFlags.length > 0 ? (
                              <Badge tone="warning">{entry.reviewFlags.length} flagged</Badge>
                            ) : (
                              <Badge tone="success">Clear</Badge>
                            )}
                          </span>
                        </button>
                        {open ? (
                          <div className="space-y-3 border-t border-border px-4 py-3">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                              {entry.summary}
                            </p>
                            <ReviewFlagList flags={entry.reviewFlags} />
                            <AiProvenance model={entry.model} />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
