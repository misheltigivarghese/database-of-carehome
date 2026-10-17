import { supabase } from "./supabase";
import type { DocInsight, HandoverSummary } from "../types";
import { parseExtracted, parseReviewFlags } from "../types";
import type { Result } from "./data";

/**
 * The browser NEVER talks to the AMD model directly — it calls a Supabase Edge
 * Function, which holds the model credentials as function secrets and proxies
 * the request. So no API key is ever shipped to the client.
 */
function functionError(error: unknown, context: string): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "";

  if (/failed to send a request|failed to fetch|networkerror/i.test(message)) {
    return `We couldn't reach the AI service. It may not be deployed yet — ask an administrator to check the "${context}" function.`;
  }
  if (/missing amd_model_base_url|not configured|missing.*secret/i.test(message)) {
    return "The AI model isn't connected yet. An administrator needs to add the AMD model endpoint and key.";
  }
  if (/401|403|unauthorized|forbidden/i.test(message)) {
    return "The AI service rejected our credentials. Ask an administrator to check the AMD model key.";
  }
  if (/timeout|timed out/i.test(message)) {
    return "The AI service took too long to respond. Try again in a moment.";
  }
  if (message) return message;
  return "The AI assistant couldn't complete that request. Please try again.";
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });

  if (error) {
    // Edge Functions return a JSON body with a human-readable `error` field.
    const detail = await readErrorDetail(error);
    return { data: null, error: detail ?? functionError(error, name) };
  }
  if (!data) return { data: null, error: "The AI service returned an empty response." };
  return { data, error: null };
}

async function readErrorDetail(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown }).context;
  if (context && typeof context === "object" && "json" in context) {
    try {
      const body = await (context as { json: () => Promise<unknown> }).json();
      if (body && typeof body === "object" && "error" in body) {
        const detail = String((body as { error: unknown }).error);
        return detail || null;
      }
    } catch {
      return null;
    }
  }
  return null;
}

interface RawInsight {
  id: string;
  resident_id: string;
  document_id: string | null;
  document_name?: string | null;
  extracted_json: unknown;
  summary: string | null;
  review_flags: unknown;
  model: string | null;
  created_at: string;
}

function toDocInsight(raw: RawInsight): DocInsight {
  return {
    id: raw.id,
    resident_id: raw.resident_id,
    document_id: raw.document_id,
    documentName: raw.document_name ?? null,
    extracted: parseExtracted(raw.extracted_json),
    summary: raw.summary,
    reviewFlags: parseReviewFlags(raw.review_flags),
    model: raw.model,
    createdAt: raw.created_at,
  };
}

/** AI-A: run care-plan document understanding for one uploaded document. */
export async function analyseDocument(documentId: string): Promise<Result<DocInsight>> {
  const { data, error } = await invoke<RawInsight>("analyze-document", { documentId });
  if (error || !data) {
    return { data: null, error: error ?? "The AI service returned an empty response." };
  }
  return { data: toDocInsight(data), error: null };
}

interface RawHandover {
  id: string;
  resident_id: string;
  summary: string;
  review_flags: unknown;
  model: string | null;
  created_at: string;
}

/** AI-B: condense recent care notes into a shift-handover brief. */
export async function generateHandover(
  residentId: string,
  noteLimit = 12,
): Promise<Result<HandoverSummary>> {
  const { data, error } = await invoke<RawHandover>("handover-summary", { residentId, noteLimit });
  if (error || !data) {
    return { data: null, error: error ?? "The AI service returned an empty response." };
  }
  return {
    data: {
      id: data.id,
      resident_id: data.resident_id,
      summary: data.summary,
      reviewFlags: parseReviewFlags(data.review_flags),
      model: data.model,
      createdAt: data.created_at,
    },
    error: null,
  };
}

/* --------------------------- stored AI results (read) -------------------------- */

export async function listDocInsights(residentId: string): Promise<Result<DocInsight[]>> {
  const { data, error } = await supabase
    .from("doc_insights")
    .select("id, resident_id, document_id, extracted_json, summary, review_flags, model, created_at")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: "We couldn't load the document insights." };
  return { data: (data ?? []).map((row) => toDocInsight(row as RawInsight)), error: null };
}

export async function listHandovers(residentId: string): Promise<Result<HandoverSummary[]>> {
  const { data, error } = await supabase
    .from("handover_summaries")
    .select("*")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: "We couldn't load the handover summaries." };

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      resident_id: row.resident_id,
      summary: row.summary,
      reviewFlags: parseReviewFlags(row.review_flags),
      model: row.model,
      createdAt: row.created_at,
    })),
    error: null,
  };
}
