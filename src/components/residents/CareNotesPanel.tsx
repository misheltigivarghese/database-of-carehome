import { useState } from "react";
import type { FormEvent } from "react";
import { MessageSquarePlus, NotebookText, Trash2 } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { createCareNote, deleteCareNote, type CareNoteRow } from "../../lib/data";
import { formatDateTime, initials, relativeTime } from "../../lib/format";
import { Button, IconButton } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { TextAreaField } from "../ui/Field";
import { LoadingPanel } from "../ui/Spinner";
import { useToast } from "../ui/Toast";

interface CareNotesPanelProps {
  residentId: string;
  residentName: string;
  notes: CareNoteRow[];
  staffNames: Map<string, string>;
  loading: boolean;
  onChanged: () => void;
}

const MAX_NOTE_LENGTH = 4000;

export function CareNotesPanel({
  residentId,
  residentName,
  notes,
  staffNames,
  loading,
  onChanged,
}: CareNotesPanelProps) {
  const { session, displayName, isAdmin } = useAuth();
  const toast = useToast();

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CareNoteRow | null>(null);

  const currentUserId = session?.user?.id ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = body.trim();
    if (!trimmed) {
      setError("Write what happened before saving — a blank note is easy to misread later.");
      return;
    }
    if (trimmed.length > MAX_NOTE_LENGTH) {
      setError(`That's ${trimmed.length} characters. Please keep notes under ${MAX_NOTE_LENGTH}.`);
      return;
    }
    if (!currentUserId) {
      setError("Your session expired. Sign in again to add a note.");
      return;
    }

    setSaving(true);
    const result = await createCareNote(residentId, trimmed, currentUserId);
    setSaving(false);

    if (result.error) {
      toast.error("Note not saved", result.error);
      return;
    }

    setBody("");
    setError(null);
    toast.success("Care note added", "It's now at the top of the timeline and included in handovers.");
    onChanged();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Add a care note"
          description={`What should the next shift know about ${residentName}?`}
          icon={<MessageSquarePlus aria-hidden="true" className="size-4" />}
        />
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <TextAreaField
              id="care-note-body"
              label="Note"
              required
              rows={4}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setError(null);
              }}
              placeholder="e.g. Ate half of lunch, said the soup was too salty. Slight cough in the afternoon — mentioned to the nurse."
              hint={`Signed as ${displayName}. Notes can't be edited after saving, so add a new one to correct something.`}
              error={error}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground tabular-nums">
                {body.trim().length}/{MAX_NOTE_LENGTH} characters
              </p>
              <Button
                type="submit"
                loading={saving}
                icon={<MessageSquarePlus aria-hidden="true" className="size-4" />}
              >
                Save note
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Care notes"
          description={
            notes.length === 0
              ? "No notes recorded yet."
              : `${notes.length} note${notes.length === 1 ? "" : "s"}, newest first.`
          }
          icon={<NotebookText aria-hidden="true" className="size-4" />}
        />

        <CardBody className="p-0">
          {loading ? (
            <LoadingPanel label="Loading care notes…" />
          ) : notes.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<NotebookText aria-hidden="true" className="size-5" />}
                title="Nothing recorded yet"
                description={`Add the first note about ${residentName}. These notes feed the shift-handover brief, so even small observations are useful.`}
                className="border-0 bg-transparent py-6"
              />
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {notes.map((note) => {
                const author = note.author_id ? staffNames.get(note.author_id) : null;
                const authorLabel = author ?? "Staff member";
                const canDelete = isAdmin || (currentUserId !== null && note.author_id === currentUserId);

                return (
                  <li key={note.id} className="flex gap-3 px-5 py-4">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                    >
                      {initials(authorLabel)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-sm font-semibold text-foreground">{authorLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          <time dateTime={note.created_at} title={formatDateTime(note.created_at)}>
                            {relativeTime(note.created_at)}
                          </time>
                        </p>
                      </div>
                      <p className="mt-1.5 text-sm whitespace-pre-wrap text-foreground">
                        {note.body}
                      </p>
                    </div>

                    {canDelete ? (
                      <IconButton
                        label={`Delete note from ${authorLabel}`}
                        icon={<Trash2 aria-hidden="true" className="size-3.5" />}
                        onClick={() => setPendingDelete(note)}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this care note?"
        description="The note will be removed from the timeline and won't be included in future handover briefs. This can't be undone."
        confirmLabel="Delete note"
        onConfirm={async () => {
          if (!pendingDelete) return;
          const result = await deleteCareNote(pendingDelete.id);
          if (result.error) {
            toast.error("Note not deleted", result.error);
            return;
          }
          toast.success("Care note deleted", "It's no longer part of the record.");
          onChanged();
        }}
      />
    </div>
  );
}
