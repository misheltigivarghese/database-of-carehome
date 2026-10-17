/** Join conditional class names. Keeps JSX readable without pulling in a dependency. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Turn a caught value into something safe to show a member of care staff. */
export function messageFrom(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const raw = String((error as { message: unknown }).message ?? "").trim();
    if (raw) return raw;
  }
  return fallback;
}
