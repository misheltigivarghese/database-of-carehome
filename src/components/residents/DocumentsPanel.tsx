import { useRef, useState } from "react";
import {
  AlertTriangle,
  FileText,
  FolderOpen,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { analyseDocument } from "../../lib/ai";
import {
  createDocumentUrl,
  deleteDocument,
  uploadDocument,
  type DocumentRow,
} from "../../lib/data";
import {
  ALLOWED_UPLOAD_LABEL,
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
} from "../../lib/supabase";
import { formatBytes, formatDateTime, relativeTime } from "../../lib/format";
import type { DocInsight } from "../../types";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/Badge";
import { Button, IconButton } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { LoadingPanel } from "../ui/Spinner";
import { useToast } from "../ui/Toast";

interface DocumentsPanelProps {
  residentId: string;
  documents: DocumentRow[];
  insights: DocInsight[];
  loading: boolean;
  onChanged: () => void;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    return `${file.name} isn't a supported type. Please upload a ${ALLOWED_UPLOAD_LABEL}.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}. The limit is 10 MB per file.`;
  }
  if (file.size === 0) {
    return `${file.name} looks empty. Check the scan and try again.`;
  }
  return null;
}

export function DocumentsPanel({
  residentId,
  documents,
  insights,
  loading,
  onChanged,
}: DocumentsPanelProps) {
  const { session, isAdmin } = useAuth();
  const toast = useToast();

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [analysingId, setAnalysingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentRow | null>(null);

  async function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      toast.error("File not uploaded", validationError);
      return;
    }

    const userId = session?.user?.id;
    if (!userId) {
      toast.error("Session expired", "Sign in again to upload documents.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    const result = await uploadDocument(residentId, file, userId);
    setUploading(false);

    if (result.error || !result.data) {
      setUploadError(result.error);
      toast.error("Upload failed", result.error ?? undefined);
      return;
    }

    toast.success(
      `${file.name} uploaded`,
      "Stored privately. Run the AI assistant to pull out the care-plan details.",
    );
    onChanged();
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleOpen(doc: DocumentRow) {
    setOpeningId(doc.id);
    const result = await createDocumentUrl(doc.storage_path);
    setOpeningId(null);

    if (result.error || !result.data) {
      toast.error("Couldn't open the document", result.error ?? undefined);
      return;
    }
    window.open(result.data, "_blank", "noopener,noreferrer");
  }

  async function handleAnalyse(doc: DocumentRow) {
    setAnalysingId(doc.id);
    const result = await analyseDocument(doc.id);
    setAnalysingId(null);

    if (result.error || !result.data) {
      toast.error("Analysis didn't finish", result.error ?? undefined);
      return;
    }

    const flagged = result.data.reviewFlags.length;
    toast.success(
      "Care-plan details extracted",
      flagged === 0
        ? "Nothing was flagged for review — still confirm against the original."
        : `${flagged} item${flagged === 1 ? "" : "s"} flagged for human review.`,
    );
    onChanged();
  }

  const insightByDocument = new Map<string, DocInsight>();
  for (const insight of insights) {
    if (insight.document_id && !insightByDocument.has(insight.document_id)) {
      insightByDocument.set(insight.document_id, insight);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Care-plan documents"
        description="Stored privately. Only signed-in staff can open them, through links that expire."
        icon={<FolderOpen aria-hidden="true" className="size-4" />}
      />

      <CardBody className="space-y-5">
        {isAdmin ? (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              void handleFiles(event.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-card border border-dashed px-4 py-6 text-center transition-colors duration-150",
              dragActive ? "border-primary bg-primary/5" : "border-border-strong bg-muted/30",
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full bg-surface text-muted-foreground shadow-card"
            >
              <Upload className="size-4" />
            </span>
            <p className="text-sm font-medium text-foreground">
              {dragActive ? "Drop the file to upload" : "Drag a care plan here"}
            </p>
            <p className="text-xs text-muted-foreground">{ALLOWED_UPLOAD_LABEL}</p>
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_UPLOAD_TYPES.join(",")}
              className="sr-only"
              id="document-upload"
              onChange={(event) => void handleFiles(event.target.files)}
            />
            <Button
              size="sm"
              variant="secondary"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              Choose a file
            </Button>
            {uploadError ? (
              <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle aria-hidden="true" className="size-3.5" />
                {uploadError}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
            Documents are uploaded by an administrator. You can open anything already on this
            record.
          </p>
        )}

        {loading ? (
          <LoadingPanel label="Loading documents…" />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileText aria-hidden="true" className="size-5" />}
            title="No documents attached"
            description={
              isAdmin
                ? "Upload an admission care plan and the AI assistant can turn it into confidence-tagged fields and a plain-language summary."
                : "Once an administrator uploads a care plan, the AI assistant's extraction will appear here."
            }
          />
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => {
              const insight = insightByDocument.get(doc.id);
              const flagged = insight?.reviewFlags.length ?? 0;

              return (
                <li
                  key={doc.id}
                  className="rounded-card border border-border bg-surface px-4 py-3.5"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                    >
                      <FileText className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {doc.file_name || "Untitled document"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatBytes(doc.size_bytes)}
                        <span aria-hidden="true"> · </span>
                        Uploaded{" "}
                        <time dateTime={doc.created_at} title={formatDateTime(doc.created_at)}>
                          {relativeTime(doc.created_at)}
                        </time>
                      </p>
                      {insight ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone="info" icon={<Sparkles aria-hidden="true" className="size-3" />}>
                            Analysed
                          </Badge>
                          {flagged > 0 ? (
                            <Badge tone="warning">
                              {flagged} to review
                            </Badge>
                          ) : (
                            <Badge tone="success">Nothing flagged</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            See the AI assistant tab for the extracted details.
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={openingId === doc.id}
                        onClick={() => void handleOpen(doc)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={analysingId === doc.id}
                        icon={<Sparkles aria-hidden="true" className="size-3.5" />}
                        onClick={() => void handleAnalyse(doc)}
                      >
                        {insight ? "Re-analyse" : "Analyse"}
                      </Button>
                      {isAdmin ? (
                        <IconButton
                          label={`Delete ${doc.file_name || "document"}`}
                          icon={<Trash2 aria-hidden="true" className="size-3.5" />}
                          onClick={() => setPendingDelete(doc)}
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this document?"
        description={
          pendingDelete
            ? `${pendingDelete.file_name || "This document"} will be removed from storage and from the record. Any AI extraction already saved stays in the record. This can't be undone.`
            : ""
        }
        confirmLabel="Delete document"
        onConfirm={async () => {
          if (!pendingDelete) return;
          const result = await deleteDocument(pendingDelete);
          if (result.error) {
            toast.error("Document not deleted", result.error);
            return;
          }
          toast.success("Document deleted", "It was removed from private storage.");
          onChanged();
        }}
      />
    </Card>
  );
}
