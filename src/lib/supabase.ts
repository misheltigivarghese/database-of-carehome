import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Environment settings.",
  );
}

/**
 * Browser client. Uses the publishable (anon) key only — every read and write is
 * still gated by the Row Level Security policies on the database, so the client
 * is never trusted for authorisation.
 *
 * `flowType: "implicit"` is deliberate: the app runs inside an ephemeral preview
 * iframe whose origin changes, and PKCE code-challenge storage breaks there.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  },
});

/** Private bucket holding care plans and other resident documents. */
export const DOCUMENTS_BUCKET = "resident-documents";

/** Matches the bucket's own server-side limits (enforced by Storage, mirrored in UI). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export const ALLOWED_UPLOAD_LABEL = "PDF, JPG or PNG up to 10 MB";

/** Private bucket holding a resident's profile photo. */
export const PHOTOS_BUCKET = "resident-photos";

/** Matches the bucket's own server-side limits (enforced by Storage, mirrored in UI). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const ALLOWED_PHOTO_LABEL = "JPG, PNG or WebP up to 5 MB";
