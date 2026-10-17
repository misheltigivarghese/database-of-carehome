import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { removeResidentPhoto, uploadResidentPhoto, type ResidentRow } from "../../lib/data";
import { formatBytes } from "../../lib/format";
import {
  ALLOWED_PHOTO_LABEL,
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
} from "../../lib/supabase";
import { cn } from "../../lib/utils";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useToast } from "../ui/Toast";
import { ResidentAvatar } from "./ResidentAvatar";

interface ResidentPhotoControlProps {
  resident: ResidentRow;
  photoUrl: string | null;
  onUpdated: (resident: ResidentRow) => void;
}

function validatePhoto(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type as (typeof ALLOWED_PHOTO_TYPES)[number])) {
    return `${file.name} isn't a supported image. Please use a ${ALLOWED_PHOTO_LABEL}.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}. The limit is 5 MB.`;
  }
  if (file.size === 0) {
    return `${file.name} looks empty. Try a different image.`;
  }
  return null;
}

/**
 * The resident's photo, with an upload affordance for administrators. Care staff
 * see the photo but get no controls — and the storage policies enforce the same
 * boundary server-side, so the client is never the gate.
 */
export function ResidentPhotoControl({
  resident,
  photoUrl,
  onUpdated,
}: ResidentPhotoControlProps) {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasPhoto = Boolean(resident.photo_path);

  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    const validationError = validatePhoto(file);
    if (validationError) {
      setError(validationError);
      toast.error("Photo not uploaded", validationError);
      return;
    }

    setError(null);
    setUploading(true);
    const result = await uploadResidentPhoto(resident, file);
    setUploading(false);

    if (result.error || !result.data) {
      setError(result.error);
      toast.error("Photo not uploaded", result.error ?? undefined);
      return;
    }

    toast.success(
      hasPhoto ? "Photo updated" : `${resident.name}'s photo added`,
      "It's stored privately and shown on their record.",
    );
    onUpdated(result.data);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <ResidentAvatar name={resident.name} photoUrl={photoUrl} size="lg" tone="primary" />

        {isAdmin ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_PHOTO_TYPES.join(",")}
              className="sr-only"
              onChange={(event) => void handleFile(event.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              aria-label={
                hasPhoto ? `Change ${resident.name}'s photo` : `Add a photo for ${resident.name}`
              }
              title={hasPhoto ? "Change photo" : "Add photo"}
              className={cn(
                "absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full",
                "border-2 border-surface bg-primary text-on-primary shadow-card cursor-pointer",
                "transition-colors duration-150 ease-out hover:bg-primary-hover",
                "motion-safe:active:scale-95 disabled:pointer-events-none disabled:opacity-70",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              )}
            >
              {uploading ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <Camera aria-hidden="true" className="size-3.5" />
              )}
            </button>
          </>
        ) : null}
      </div>

      {isAdmin && hasPhoto ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="cursor-pointer text-xs font-medium text-muted-foreground underline-offset-2 transition-colors duration-150 hover:text-destructive hover:underline"
        >
          Remove photo
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="max-w-40 text-center text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Remove this photo?"
        description={`${resident.name}'s photo will be deleted from their record and from private storage. This can't be undone.`}
        confirmLabel="Remove photo"
        onConfirm={async () => {
          const result = await removeResidentPhoto(resident);
          if (result.error || !result.data) {
            toast.error("Photo not removed", result.error ?? undefined);
            return;
          }
          toast.success("Photo removed", `${resident.name}'s record now shows their initials.`);
          onUpdated(result.data);
        }}
      />
    </div>
  );
}
