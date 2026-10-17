import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@1.9.0";

/**
 * AI-A — care-plan document understanding.
 *
 * Runs entirely server-side so the model credentials never reach the browser:
 *   browser → this function → AMD-hosted open-weight model
 *
 * Reads a document from the private bucket, extracts its text, asks the model
 * for structured fields + a plain-language summary, and stores the result in
 * `doc_insights` using the service role (that table has SELECT-only policies,
 * so no client can write it).
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

/* ------------------------------- model plumbing ------------------------------ */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

function modelConfig() {
  const baseUrl = Deno.env.get("AMD_MODEL_BASE_URL");
  const apiKey = Deno.env.get("AMD_MODEL_API_KEY");
  // The serving stack reports its own id; used on-screen to credit the AMD GPU.
  const model = Deno.env.get("AMD_MODEL_NAME") ?? "open-weight-instruct-on-amd";
  return { baseUrl, apiKey, model };
}

async function chat(
  messages: ChatMessage[],
  options: { maxTokens: number; temperature: number },
): Promise<string> {
  const { baseUrl, apiKey, model } = modelConfig();
  if (!baseUrl || !apiKey) {
    throw new Error(
      "MISSING_SECRET: set AMD_MODEL_BASE_URL and AMD_MODEL_API_KEY as Edge Function secrets",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        // Keeps the model on a short leash and the token bill small.
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 400);
      throw new Error(`MODEL_ERROR ${response.status}: ${detail}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("MODEL_ERROR: the model returned an empty response");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/** Models often wrap JSON in prose or fences; pull out the first object. */
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

/* ------------------------------ prompt + shaping ----------------------------- */

const SYSTEM_PROMPT = `You are a document-reading assistant inside a care-home records system in Italy.

Your job is EXTRACTION ONLY. Report what the document actually says.

Hard rules:
- Never give medical advice. Never suggest a diagnosis, treatment, medication change or clinical decision.
- Never invent a value. If the document does not state something, leave it out and add it to "gaps".
- Set "confidence" to "high", "medium" or "low" based on how clearly the document states the value.
- Set "needs_review" to true whenever a human should confirm the value — always true for anything clinical, ambiguous, abbreviated, hand-written or partially illegible.
- Prefer specific, factual labels such as "Allergies", "Medications", "Mobility", "Dietary needs", "Conditions", "Communication".
- Reply with JSON only. No prose, no markdown, no code fences.`;

const EXTRACTION_SCHEMA = `{
  "fields": [
    { "label": "string", "value": "string", "confidence": "high|medium|low", "needs_review": true }
  ],
  "gaps": ["string describing anything unreadable or missing"]
}`;

const SUMMARY_SCHEMA = `{ "summary": "3-6 sentences of plain language for a busy carer" }`;

interface ExtractedField {
  label: string;
  value: string;
  confidence: "high" | "medium" | "low";
  needs_review: boolean;
}

const CONFIDENCE_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

function normaliseFields(raw: unknown): ExtractedField[] {
  if (!Array.isArray(raw)) return [];
  const fields: ExtractedField[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const label = String(record.label ?? "").trim();
    const value = String(record.value ?? "").trim();
    if (!label || !value) continue;

    const confidenceRaw = String(record.confidence ?? "low").toLowerCase();
    const confidence =
      confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
        ? confidenceRaw
        : "low";

    fields.push({
      label,
      value,
      confidence,
      // Low confidence always forces review, even if the model said otherwise.
      needs_review: record.needs_review === true || confidence === "low",
    });
  }
  return fields;
}

function normaliseGaps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((gap) => String(gap).trim()).filter((gap) => gap.length > 0).slice(0, 12);
}

/** Merge per-chunk extractions: same label+value keeps the more confident copy. */
function mergeFields(all: ExtractedField[][]): ExtractedField[] {
  const best = new Map<string, ExtractedField>();

  for (const batch of all) {
    for (const field of batch) {
      const key = `${field.label.toLowerCase()}|${field.value.toLowerCase()}`;
      const existing = best.get(key);
      if (!existing || CONFIDENCE_ORDER[field.confidence] > CONFIDENCE_ORDER[existing.confidence]) {
        best.set(key, field);
      }
    }
  }

  return [...best.values()].slice(0, 40);
}

function buildReviewFlags(fields: ExtractedField[], gaps: string[]) {
  const flags: Array<{ label: string; detail: string; severity: string }> = [];

  const uncertain = fields.filter((field) => field.needs_review);
  if (uncertain.length > 0) {
    const hasLow = uncertain.some((field) => field.confidence === "low");
    flags.push({
      label: `${uncertain.length} extracted item${uncertain.length === 1 ? "" : "s"} need confirmation`,
      detail: `Unclear or low-confidence: ${uncertain
        .slice(0, 8)
        .map((field) => field.label)
        .join(", ")}. Check these against the original document before relying on them.`,
      severity: hasLow ? "critical" : "warning",
    });
  }

  if (gaps.length > 0) {
    flags.push({
      label: "Some of the document couldn't be read",
      detail: gaps.slice(0, 4).join(" "),
      severity: "warning",
    });
  }

  return flags;
}

/* ---------------------------------- helpers --------------------------------- */

function chunkText(text: string, size: number, overlap: number): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length && chunks.length < 4) {
    chunks.push(text.slice(cursor, cursor + size));
    cursor += size - overlap;
  }
  return chunks;
}

async function loadExtractionChunk(
  chunk: string,
  label: string,
): Promise<{ fields: ExtractedField[]; gaps: string[] }> {
  const raw = await chat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${label}\n\nRespond with JSON exactly in this shape:\n${EXTRACTION_SCHEMA}\n\nDocument text:\n"""\n${chunk}\n"""`,
      },
    ],
    { maxTokens: 1100, temperature: 0.1 },
  );

  const parsed = parseJsonObject(raw);
  if (!parsed) return { fields: [], gaps: ["The model's response could not be read as structured data."] };
  return { fields: normaliseFields(parsed.fields), gaps: normaliseGaps(parsed.gaps) };
}

/* ----------------------------------- entry ---------------------------------- */

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

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "The backend isn't fully configured. Ask an administrator." }, 500);
  }

  // 1. Authenticate the caller from the JWT they sent (verify_jwt is disabled,
  //    so this is the real check).
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

  let documentId = "";
  try {
    const body = (await req.json()) as { documentId?: string };
    documentId = String(body.documentId ?? "");
  } catch {
    return json({ error: "We couldn't read that request." }, 400);
  }
  if (!documentId) return json({ error: "No document was specified." }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  // 2. Load the document through the caller's own session first, so RLS decides
  //    whether they are allowed to see it at all.
  const { data: document, error: documentError } = await userClient
    .from("documents")
    .select("id, resident_id, storage_path, file_name, mime_type")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError) return json({ error: "We couldn't load that document." }, 500);
  if (!document) return json({ error: "That document doesn't exist, or you can't access it." }, 404);

  // 3. Fetch the file bytes and turn them into text.
  const { data: file, error: downloadError } = await admin.storage
    .from("resident-documents")
    .download(document.storage_path);

  if (downloadError || !file) {
    return json({ error: "We couldn't read that file from storage." }, 500);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = (document.mime_type ?? "").includes("pdf");

  let sourceText = "";
  let imagePart: Record<string, unknown> | null = null;

  if (isPdf) {
    try {
      const pdf = await getDocumentProxy(bytes);
      const { text, totalPages } = await extractText(pdf, { mergePages: true });
      sourceText = (Array.isArray(text) ? text.join("\n") : text).trim();
    } catch {
      return json(
        {
          error:
            "We couldn't read any text from that PDF. If it's a scan, upload it as a JPG or PNG image instead.",
        },
        422,
      );
    }

    if (sourceText.length < 40) {
      return json(
        {
          error:
            "That PDF has almost no readable text — it looks like a scan. Upload it as a JPG or PNG so the model can read the image.",
        },
        422,
      );
    }
  } else {
    // Scanned page: hand the image to the model directly.
    let binary = "";
    const step = 8192;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    imagePart = {
      type: "image_url",
      image_url: {
        url: `data:${document.mime_type ?? "image/png"};base64,${btoa(binary)}`,
      },
    };
  }

  // 4. Extract. Long documents are chunked with overlap, then merged.
  const { baseUrl, apiKey, model } = modelConfig();
  if (!baseUrl || !apiKey) {
    return json(
      {
        error:
          "The AI model isn't connected yet. An administrator needs to add the AMD model endpoint (AMD_MODEL_BASE_URL) and key (AMD_MODEL_API_KEY) as function secrets.",
      },
      503,
    );
  }

  try {
    let fields: ExtractedField[] = [];
    let gaps: string[] = [];

    if (imagePart) {
      const raw = await chat(
        [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `This is a scanned page from a care plan. Read it and respond with JSON exactly in this shape:\n${EXTRACTION_SCHEMA}`,
              },
              imagePart,
            ],
          },
        ],
        { maxTokens: 1100, temperature: 0.1 },
      );
      const parsed = parseJsonObject(raw);
      fields = parsed ? normaliseFields(parsed.fields) : [];
      gaps = parsed
        ? normaliseGaps(parsed.gaps)
        : ["The model's response could not be read as structured data."];
    } else {
      const chunks = chunkText(sourceText, 6000, 400);
      const batches: ExtractedField[][] = [];

      for (let index = 0; index < chunks.length; index += 1) {
        const label =
          chunks.length === 1
            ? "Extract every field from this care plan."
            : `This is part ${index + 1} of ${chunks.length} of a longer care plan. Extract every field in THIS part only.`;
        const result = await loadExtractionChunk(chunks[index], label);
        batches.push(result.fields);
        gaps = [...gaps, ...result.gaps].slice(0, 12);
      }

      fields = mergeFields(batches);
    }

    // 5. Plain-language summary over the text we managed to read.
    const summaryInput = imagePart
      ? `Extracted fields:\n${JSON.stringify(fields, null, 1)}`
      : `Extracted fields:\n${JSON.stringify(fields, null, 1)}\n\nOpening of the document:\n"""\n${sourceText.slice(0, 4000)}\n"""`;

    const summaryRaw = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Write a plain-language summary of this resident's care plan for a busy carer starting a shift. Describe only what is in the source. Do not advise, diagnose or recommend treatment. If something important is missing or unclear, say so plainly. Respond with JSON only, in this shape:\n${SUMMARY_SCHEMA}\n\n${summaryInput}`,
        },
      ],
      { maxTokens: 500, temperature: 0.2 },
    );

    const summaryParsed = parseJsonObject(summaryRaw);
    const summary =
      typeof summaryParsed?.summary === "string" && summaryParsed.summary.trim().length > 0
        ? summaryParsed.summary.trim()
        : null;

    const reviewFlags = buildReviewFlags(fields, gaps);

    // 6. Persist with the service role — doc_insights is SELECT-only for clients.
    const { data: saved, error: saveError } = await admin
      .from("doc_insights")
      .insert({
        resident_id: document.resident_id,
        document_id: document.id,
        extracted_json: { fields, gaps },
        summary,
        review_flags: reviewFlags,
        model,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (saveError) {
      return json({ error: "The extraction succeeded but couldn't be saved. Try again." }, 500);
    }

    return json({ ...saved, document_name: document.file_name }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("MISSING_SECRET")) {
      return json(
        {
          error:
            "The AI model isn't connected yet. An administrator needs to add the AMD model endpoint and key as function secrets.",
        },
        503,
      );
    }
    if (message.includes("MODEL_ERROR 401") || message.includes("MODEL_ERROR 403")) {
      return json({ error: "The AI service rejected our credentials. Check the AMD model key." }, 502);
    }
    if (message.includes("aborted") || message.includes("AbortError")) {
      return json({ error: "The AI service took too long to respond. Try again." }, 504);
    }
    if (message.includes("MODEL_ERROR")) {
      return json({ error: "The AI service returned an error. Try again in a moment." }, 502);
    }
    return json({ error: "We couldn't analyse that document. Please try again." }, 500);
  }
});
