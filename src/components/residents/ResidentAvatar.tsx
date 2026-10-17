import { useEffect, useState } from "react";

import { initials } from "../../lib/format";
import { cn } from "../../lib/utils";

type AvatarSize = "sm" | "md" | "lg";

const SIZES: Record<AvatarSize, string> = {
  sm: "size-10 text-sm",
  md: "size-12 text-base",
  lg: "size-16 text-lg",
};

interface ResidentAvatarProps {
  name: string;
  /** Signed URL for the resident's photo, or null when none is on file. */
  photoUrl?: string | null;
  size?: AvatarSize;
  tone?: "muted" | "primary";
  className?: string;
}

/**
 * A resident's photo when one is on file, otherwise their initials.
 * The image is decorative — the resident's name is always shown alongside it —
 * so it carries an empty alt, and it falls back to initials if the signed URL
 * has expired or the object has gone.
 */
export function ResidentAvatar({
  name,
  photoUrl,
  size = "sm",
  tone = "muted",
  className,
}: ResidentAvatarProps) {
  const [failed, setFailed] = useState(false);

  // A new photo URL deserves a fresh attempt even if the last one 404'd.
  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  const showPhoto = Boolean(photoUrl) && !failed;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none",
        SIZES[size],
        tone === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {showPhoto ? (
        <img
          src={photoUrl as string}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
