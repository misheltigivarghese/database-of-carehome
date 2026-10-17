import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * AI-B — shift-handover brief.
 *
 * Condenses a resident's recent care notes into something the next shift can
 * read in thirty seconds, and flags anything a person should check. Same shape
 * as AI-A: browser → this function → AMD-hosted model → `handover_summaries`
 * via the service role (clients only have SELECT on that table).
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are a shift-handover assistant inside a care-home records system in Italy.

You condense recent care notes into a brief for the carer starting the next shift.

Hard rules:
- Never diagnose. Never recommend, start or change any treatment or medication.
- Use ONLY what is written in the notes. Never invent an event, a time or a detail.
- Lead with what the next shift must know or act on first.
- Explicitly surface anything that looks like a CHANGE — new, worsening, or inconsistent with earlier notes — and anything a person should verify.
- If the notes are too thin to support a conclusion, say so instead of padding it out.
- Address the reader directly and plainly. No emojis.
- Reply with JSON only. No prose, no markdown, no code fences.`;

const SCHEMA = `{
  "summary": "plain text, at most 170 words, short lines or short headings separated by newlines",
  "review_flags": [
    { "label": "short label", "detail": "what to check, and why", "severity": "info|warning|critical" }
  ]
}`;

const SEVERITIES = ["info", "warning", "critical"];

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normaliseFlags(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const flags: Array<{ label: string; detail: string; severity: string }> = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const label = String(record.label ?? "").trim();
    const detail = String(record.detail ?? "").trim();
    if (!label) continue;

    const severityRaw = String(record.severity ?? "warning").toLowerCase();
    flags.push({
      label,
      detail,
      severity: SEVERITIES.includes(severityRaw) ? severityRaw : "warning",
    });
  }
  return flags.slice(0, 8);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "This endpoint only accepts POST requests." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  const baseUrl = Deno.env.get("AMD_MODEL_BASE_URL");
  const apiKey = Deno.env.get("AMD_MODEL_API_KEY");
  const model = Deno.env.get("AMD_MODEL_NAME") ?? "open-weight-instruct-on-amd";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "The backend isn't fully configured. Ask an administrator." }, 500);
  }
  if (!baseUrl || !apiKey) {
    return json(
      {
        error:
          "The AI model isn't connected yet. An administrator needs to add the AMD model endpoint (AMD_MODEL_BASE_URL) and key (AMD_MODEL_API_KEY) as function secrets.",
      },
      503,
    );
  }

  // 1. Authenticate the caller (verify_jwt is disabled, so this is the real check).
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in to use the AI assistant." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ error: "Your session has expired. Sign in again." }, 401);
  }

  let residentId = "";
  let noteLimit = 12;
  try {
    const body = (await req.json()) as { residentId?: string; noteLimit?: number };
    residentId = String(body.residentId ?? "");
    const requested = Number(body.noteLimit ?? 12);
    if (Number.isFinite(requested)) noteLimit = Math.min(Math.max(Math.trunc(requested), 1), 25);
  } catch {
    return json({ error: "We couldn't read that request." }, 400);
  }
  if (!residentId) return json({ error: "No resident was specified." }, 400);

  // 2. Read through the caller's session so RLS decides what they may see.
  const { data: resident, error: residentError } = await userClient
    .from("residents")
    .select("id, name, care_needs")
    .eq("id", residentId)
    .maybeSingle();

  if (residentError) return json({ error: "We couldn't load that resident." }, 500);
  if (!resident) return json({ error: "That resident doesn't exist, or you can't access them." }, 404);

  const { data: notes, error: notesError } = await userClient
    .from("care_notes")
    .select("body, created_at")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false })
    .limit(noteLimit);

  if (notesError) return json({ error: "We couldn't load the care notes." }, 500);
  if (!notes || notes.length === 0) {
    return json(
      { error: "There are no care notes to summarise yet. Add at least one note first." },
      400,
    );
  }

  // Oldest → newest reads as a narrative for the reader.
  const ordered = [...notes].reverse();
  const notesBlock = ordered
    .map((note) => `- [${note.created_at}] ${note.body.replace(/\s+/g, " ").trim()}`)
    .join("\n")
    .slice(0, 8000);

  const userPrompt = `Resident: ${resident.name}
Notes cover the most recent ${ordered.length} care note(s), oldest first.

Respond with JSON only, in this shape:
${SCHEMA}

Care notes:
"""
${notesBlock}
"""`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ] satisfies ChatMessage[],
          temperature: 0.2,
          max_tokens: 700,
          top_p: 0.9,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      if (response.status === 401 || response.status === 403) {
        return json({ error: "The AI service rejected our credentials. Check the AMD model key." }, 502);
      }
      return json({ error: `The AI service returned an error (${response.status}). ${detail}` }, 502);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return json({ error: "The AI service returned an empty response." }, 502);

    const parsed = parseJsonObject(content);
    const summary =
      typeof parsed?.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : null;

    if (!summary) {
      return json({ error: "The AI service returned a brief we couldn't read. Try again." }, 502);
    }

    const reviewFlags = normaliseFlags(parsed?.review_flags);

    // 3. Persist with the service role — clients only have SELECT here.
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: saved, error: saveError } = await admin
      .from("handover_summaries")
      .insert({
        resident_id: residentId,
        summary,
        review_flags: reviewFlags,
        model,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (saveError) {
      return json({ error: "The brief was generated but couldn't be saved. Try again." }, 500);
    }

    return json(saved, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("abort")) {
      return json({ error: "The AI service took too long to respond. Try again." }, 504);
    }
    return json({ error: "We couldn't generate the handover brief. Please try again." }, 500);
  }
});
