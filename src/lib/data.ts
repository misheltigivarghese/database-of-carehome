import { DOCUMENTS_BUCKET, PHOTOS_BUCKET, supabase } from "./supabase";
import type { Database } from "./database.types";

export type ResidentRow = Database["public"]["Tables"]["residents"]["Row"];
export type CareNoteRow = Database["public"]["Tables"]["care_notes"]["Row"];
export type ContactRow = Database["public"]["Tables"]["emergency_contacts"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

export interface Result<T> {
  data: T | null;
  error: string | null;
}

const ok = <T,>(data: T): Result<T> => ({ data, error: null });
const err = <T,>(error: string): Result<T> => ({ data: null, error });

/**
 * Turn Postgres/PostgREST failures into something a carer can act on.
 * RLS denials surface as 42501, which is a permission story, not a bug report.
 */
export function friendlyDbError(
  error: { message: string; code?: string | null },
  action: string,
): string {
  const code = error.code ?? "";
  if (code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    return `Your role doesn't allow you to ${action}. An administrator can do it.`;
  }
  if (code === "23503") {
    return `That record is still linked to other information, so it can't be ${action.replace(/^(create|save|delete|remove) /, "")} yet.`;
  }
  if (code === "23514") return "One of the values wasn't accepted. Check the form and try again.";
  if (code === "23505") return "That already exists — try a slightly different value.";
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return `We couldn't ${action}. Please try again.`;
}

function friendlyStorageError(message: string): string {
  if (/exceeded the maximum allowed size|too large/i.test(message)) {
    return "That file is larger than 10 MB. Try a smaller scan or a compressed copy.";
  }
  if (/mime type|not supported/i.test(message)) {
    return "That file type isn't supported. Upload a PDF, JPG or PNG.";
  }
  if (/row-level security|permission|denied/i.test(message)) {
    return "Your role doesn't allow document uploads. An administrator can upload it.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "The upload didn't reach the server. Check your connection and try again.";
  }
  return "We couldn't upload that file. Please try again.";
}

/** Storage failures for the photo bucket, phrased for a carer rather than a developer. */
function friendlyPhotoStorageError(message: string): string {
  if (/exceeded the maximum allowed size|too large/i.test(message)) {
    return "That photo is larger than 5 MB. Try a smaller image or a compressed copy.";
  }
  if (/mime type|not supported/i.test(message)) {
    return "That image type isn't supported. Upload a JPG, PNG or WebP.";
  }
  if (/row-level security|permission|denied/i.test(message)) {
    return "Your role doesn't allow changing resident photos. An administrator can do it.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "The upload didn't reach the server. Check your connection and try again.";
  }
  return "We couldn't upload that photo. Please try again.";
}

/** PostgREST filter strings treat these as syntax or wildcards. */
function sanitiseSearch(term: string): string {
  return term.replace(/[%_(),\\*]/g, " ").trim();
}

/* ---------------------------------- residents --------------------------------- */

export async function listResidents(search = ""): Promise<Result<ResidentRow[]>> {
  let query = supabase.from("residents").select("*").order("name", { ascending: true });

  const term = sanitiseSearch(search);
  if (term) {
    query = query.or(`name.ilike.%${term}%,room_number.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) return err(friendlyDbError(error, "load residents"));
  return ok(data ?? []);
}

export async function getResident(id: string): Promise<Result<ResidentRow>> {
  const { data, error } = await supabase.from("residents").select("*").eq("id", id).maybeSingle();
  if (error) return err(friendlyDbError(error, "load that resident"));
  if (!data) return err("We couldn't find that resident. They may have been removed.");
  return ok(data);
}

export interface ResidentInput {
  name: string;
  dob: string | null;
  room_number: string | null;
  admission_date: string | null;
  care_needs: string | null;
}

export async function createResident(input: ResidentInput): Promise<Result<ResidentRow>> {
  const { data, error } = await supabase.from("residents").insert(input).select().single();
  if (error) return err(friendlyDbError(error, "add that resident"));
  return ok(data);
}

export async function updateResident(
  id: string,
  input: Partial<ResidentInput>,
): Promise<Result<ResidentRow>> {
  const { data, error } = await supabase
    .from("residents")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return err(friendlyDbError(error, "save those changes"));
  return ok(data);
}

export async function deleteResident(id: string): Promise<Result<true>> {
  // Read the photo path first: once the row is gone there's no pointer to the
  // object, so its stored file would be orphaned in the bucket forever.
  const { data: existing } = await supabase
    .from("residents")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("residents").delete().eq("id", id);
  if (error) return err(friendlyDbError(error, "delete that resident"));

  if (existing?.photo_path) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([existing.photo_path]);
  }
  return ok(true);
}

/* ---------------------------------- photos ----------------------------------- */

/**
 * Uploads a resident's photo to the private bucket, then points the record at it.
 * The object is written first and the row second; if the row update is rejected
 * the orphaned upload is removed. The previous photo is only deleted after the
 * new pointer is saved, so a failure never leaves the resident without a photo.
 */
export async function uploadResidentPhoto(
  resident: Pick<ResidentRow, "id" | "photo_path">,
  file: File,
): Promise<Result<ResidentRow>> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-60) || "photo";
  const path = `${resident.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) return err(friendlyPhotoStorageError(uploadError.message));

  const { data, error } = await supabase
    .from("residents")
    .update({ photo_path: path, updated_at: new Date().toISOString() })
    .eq("id", resident.id)
    .select()
    .single();

  if (error) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    return err(friendlyDbError(error, "save that photo"));
  }

  if (resident.photo_path && resident.photo_path !== path) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([resident.photo_path]);
  }

  return ok(data);
}

/** Clears the pointer first, then deletes the stored file. */
export async function removeResidentPhoto(resident: ResidentRow): Promise<Result<ResidentRow>> {
  const { data, error } = await supabase
    .from("residents")
    .update({ photo_path: null, updated_at: new Date().toISOString() })
    .eq("id", resident.id)
    .select()
    .single();

  if (error) return err(friendlyDbError(error, "remove that photo"));

  if (resident.photo_path) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([resident.photo_path]);
  }
  return ok(data);
}

/**
 * Short-lived signed URLs for a batch of private photo paths, keyed by path.
 * Photos are never public objects, so every screen resolves them this way.
 */
export async function createResidentPhotoUrls(
  paths: string[],
  expiresInSeconds = 60 * 60,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter((path) => Boolean(path))));
  if (unique.length === 0) return map;

  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrls(unique, expiresInSeconds);

  if (error || !data) return map;
  for (const item of data) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

/* --------------------------------- care notes -------------------------------- */

export async function listCareNotes(residentId: string): Promise<Result<CareNoteRow[]>> {
  const { data, error } = await supabase
    .from("care_notes")
    .select("*")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false });
  if (error) return err(friendlyDbError(error, "load care notes"));
  return ok(data ?? []);
}

export async function createCareNote(
  residentId: string,
  body: string,
  authorId: string,
): Promise<Result<CareNoteRow>> {
  const { data, error } = await supabase
    .from("care_notes")
    .insert({ resident_id: residentId, body: body.trim(), author_id: authorId })
    .select()
    .single();
  if (error) return err(friendlyDbError(error, "save that care note"));
  return ok(data);
}

export async function deleteCareNote(id: string): Promise<Result<true>> {
  const { error } = await supabase.from("care_notes").delete().eq("id", id);
  if (error) return err(friendlyDbError(error, "delete that care note"));
  return ok(true);
}

/* ------------------------------ emergency contacts --------------------------- */

export async function listContacts(residentId: string): Promise<Result<ContactRow[]>> {
  const { data, error } = await supabase
    .from("emergency_contacts")
    .select("*")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: true });
  if (error) return err(friendlyDbError(error, "load emergency contacts"));
  return ok(data ?? []);
}

export interface ContactInput {
  name: string;
  relationship: string | null;
  phone: string | null;
}

export async function createContact(
  residentId: string,
  input: ContactInput,
): Promise<Result<ContactRow>> {
  const { data, error } = await supabase
    .from("emergency_contacts")
    .insert({ ...input, resident_id: residentId })
    .select()
    .single();
  if (error) return err(friendlyDbError(error, "add that contact"));
  return ok(data);
}

export async function updateContact(
  id: string,
  input: Partial<ContactInput>,
): Promise<Result<ContactRow>> {
  const { data, error } = await supabase
    .from("emergency_contacts")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) return err(friendlyDbError(error, "save that contact"));
  return ok(data);
}

export async function deleteContact(id: string): Promise<Result<true>> {
  const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
  if (error) return err(friendlyDbError(error, "remove that contact"));
  return ok(true);
}

/* --------------------------------- documents --------------------------------- */

export async function listDocuments(residentId: string): Promise<Result<DocumentRow[]>> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false });
  if (error) return err(friendlyDbError(error, "load documents"));
  return ok(data ?? []);
}

/**
 * Uploads to the private bucket, then records the row. If the row insert is
 * rejected (e.g. RLS denies a care_staff upload), the orphaned object is
 * removed so storage and the table never drift apart.
 */
export async function uploadDocument(
  residentId: string,
  file: File,
  userId: string,
): Promise<Result<DocumentRow>> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "document";
  const path = `${residentId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) return err(friendlyStorageError(uploadError.message));

  const { data, error } = await supabase
    .from("documents")
    .insert({
      resident_id: residentId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userId,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    return err(friendlyDbError(error, "save that document"));
  }

  return ok(data);
}

/** Short-lived link into the private bucket. 5 minutes by default. */
export async function createDocumentUrl(
  storagePath: string,
  expiresInSeconds = 300,
): Promise<Result<string>> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return err(
      /failed to fetch|networkerror/i.test(error?.message ?? "")
        ? "We couldn't reach the server to open that file. Try again."
        : "We couldn't open that document. It may have been removed.",
    );
  }
  return ok(data.signedUrl);
}

export async function deleteDocument(doc: DocumentRow): Promise<Result<true>> {
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) return err(friendlyDbError(error, "delete that document"));

  // Only remove the stored file once the row is gone, so nothing is orphaned.
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
  return ok(true);
}

/* ---------------------------------- profiles --------------------------------- */

/** care_notes.author_id points at auth.users, so author names are resolved client-side. */
export async function listStaffNames(): Promise<Map<string, string>> {
  const { data } = await supabase.from("profiles").select("user_id, name");
  const map = new Map<string, string>();
  for (const profile of data ?? []) {
    map.set(profile.user_id, profile.name?.trim() || "Staff member");
  }
  return map;
}
