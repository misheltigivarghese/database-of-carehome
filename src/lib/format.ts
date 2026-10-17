const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Accepts a `date` column (`YYYY-MM-DD`) or a full timestamp. */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalised = value.length <= 10 ? `${value}T00:00:00` : value;
  const parsed = new Date(normalised);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: string | null | undefined): string {
  const date = toDate(value);
  return date ? DATE_FMT.format(date) : "Not recorded";
}

export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value);
  return date ? DATETIME_FMT.format(date) : "Not recorded";
}

/** "3 days ago" style label for note and summary timelines. */
export function relativeTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "Unknown time";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["minute", 60],
    ["hour", 60 * 60],
    ["day", 60 * 60 * 24],
    ["week", 60 * 60 * 24 * 7],
    ["month", 60 * 60 * 24 * 30],
    ["year", 60 * 60 * 24 * 365],
  ];

  const formatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const unit of units) {
    if (seconds >= unit[1]) chosen = unit;
  }
  return formatter.format(-Math.round(seconds / chosen[1]), chosen[0]);
}

export function formatAge(dob: string | null | undefined): string {
  const birth = toDate(dob);
  if (!birth) return "Age not recorded";

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;

  return age >= 0 ? `${age} years` : "Age not recorded";
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "Size unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0 || !parts[0]) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
