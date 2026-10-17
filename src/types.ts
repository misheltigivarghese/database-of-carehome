/**
 * Shared shapes for the AI layer (AI-A document understanding, AI-B handover).
 * These mirror what the Edge Functions write into `doc_insights.extracted_json`,
 * `doc_insights.review_flags` and `handover_summaries.review_flags`.
 *
 * Everything coming back from the model is treated as UNTRUSTED: the parsers
 * below coerce arbitrary JSON into these shapes and drop anything malformed,
 * so a hallucinated field can never crash a screen or fake a clean bill of health.
 */

export type Confidence = "high" | "medium" | "low";
export type FlagSeverity = "info" | "warning" | "critical";

export interface ExtractedField {
  label: string;
  value: string;
  confidence: Confidence;
  needs_review: boolean;
}

export interface ReviewFlag {
  label: string;
  detail: string;
  severity: FlagSeverity;
}

export interface ExtractedPayload {
  fields: ExtractedField[];
  /** Anything the model could not read, e.g. illegible or missing sections. */
  gaps: string[];
}

export interface DocInsight {
  id: string;
  resident_id: string;
  document_id: string | null;
  documentName: string | null;
  extracted: ExtractedPayload;
  summary: string | null;
  reviewFlags: ReviewFlag[];
  model: string | null;
  createdAt: string;
}

export interface HandoverSummary {
  id: string;
  resident_id: string;
  summary: string;
  reviewFlags: ReviewFlag[];
  model: string | null;
  createdAt: string;
}

const CONFIDENCES: Confidence[] = ["high", "medium", "low"];
const SEVERITIES: FlagSeverity[] = ["info", "warning", "critical"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asConfidence(value: unknown): Confidence {
  const normalised = asString(value).toLowerCase();
  return CONFIDENCES.includes(normalised as Confidence) ? (normalised as Confidence) : "low";
}

function asSeverity(value: unknown): FlagSeverity {
  const normalised = asString(value).toLowerCase();
  return SEVERITIES.includes(normalised as FlagSeverity) ? (normalised as FlagSeverity) : "warning";
}

export function parseExtracted(value: unknown): ExtractedPayload {
  if (!isRecord(value)) return { fields: [], gaps: [] };

  const rawFields = Array.isArray(value.fields) ? value.fields : [];
  const fields: ExtractedField[] = [];

  for (const raw of rawFields) {
    if (!isRecord(raw)) continue;
    const label = asString(raw.label);
    const fieldValue = asString(raw.value);
    if (!label || !fieldValue) continue;

    const confidence = asConfidence(raw.confidence);
    fields.push({
      label,
      value: fieldValue,
      confidence,
      // Low confidence ALWAYS forces a review flag, even if the model forgot to set it.
      needs_review: raw.needs_review === true || confidence === "low",
    });
  }

  const gaps = (Array.isArray(value.gaps) ? value.gaps : [])
    .map(asString)
    .filter((gap) => gap.length > 0);

  return { fields, gaps };
}

export function parseReviewFlags(value: unknown): ReviewFlag[] {
  if (!Array.isArray(value)) return [];

  const flags: ReviewFlag[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const label = asString(raw.label);
    const detail = asString(raw.detail);
    if (!label) continue;
    flags.push({ label, detail, severity: asSeverity(raw.severity) });
  }
  return flags;
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};
