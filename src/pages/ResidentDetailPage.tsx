import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  DoorOpen,
  NotebookText,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  deleteResident,
  getResident,
  listCareNotes,
  listContacts,
  listDocuments,
  listStaffNames,
  type CareNoteRow,
  type ContactRow,
  type DocumentRow,
  type ResidentRow,
} from "../lib/data";
import { listDocInsights, listHandovers } from "../lib/ai";
import type { DocInsight, HandoverSummary } from "../types";
import { formatAge, formatDate, formatDateTime, initials, relativeTime } from "../lib/format";
import { useResidentPhotoUrls } from "../lib/photoUrls";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingPanel } from "../components/ui/Spinner";
import { TabPanel, Tabs, type TabDef } from "../components/ui/Tabs";
import { useToast } from "../components/ui/Toast";
import { ResidentFormDialog } from "../components/residents/ResidentFormDialog";
import { ContactsPanel } from "../components/residents/ContactsPanel";
import { CareNotesPanel } from "../components/residents/CareNotesPanel";
import { DocumentsPanel } from "../components/residents/DocumentsPanel";
import { ResidentPhotoControl } from "../components/residents/ResidentPhotoControl";
import { HandoverPanel } from "../components/ai/HandoverPanel";
import { InsightsPanel } from "../components/ai/InsightsPanel";

type TabId = "overview" | "notes" | "documents" | "ai";

export function ResidentDetailPage() {
  const { residentId = "" } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [resident, setResident] = useState<ResidentRow | null>(null);
  const [residentError, setResidentError] = useState<string | null>(null);
  const [loadingResident, setLoadingResident] = useState(true);

  const [notes, setNotes] = useState<CareNoteRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [insights, setInsights] = useState<DocInsight[]>([]);
  const [handovers, setHandovers] = useState<HandoverSummary[]>([]);
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());
  const [panelsLoading, setPanelsLoading] = useState(true);

  const [tab, setTab] = useState<TabId>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadPanels = useCallback(async () => {
    const [notesResult, contactsResult, documentsResult, insightsResult, handoversResult] =
      await Promise.all([
        listCareNotes(residentId),
        listContacts(residentId),
        listDocuments(residentId),
        listDocInsights(residentId),
        listHandovers(residentId),
      ]);

    setNotes(notesResult.data ?? []);
    setContacts(contactsResult.data ?? []);
    setDocuments(documentsResult.data ?? []);
    setInsights(insightsResult.data ?? []);
    setHandovers(handoversResult.data ?? []);
  }, [residentId]);

  useEffect(() => {
    let active = true;
    setLoadingResident(true);
    setPanelsLoading(true);

    void (async () => {
      const [residentResult, staff] = await Promise.all([
        getResident(residentId),
        listStaffNames(),
      ]);
      if (!active) return;

      setResident(residentResult.data);
      setResidentError(residentResult.error);
      setStaffNames(staff);
      setLoadingResident(false);

      await loadPanels();
      if (active) setPanelsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [residentId, loadPanels]);

  const refreshPanels = useCallback(() => {
    void loadPanels();
  }, [loadPanels]);

  /** Items the model explicitly asked a human to look at. */
  const reviewCount = useMemo(() => {
    const fromInsights = insights.reduce(
      (total, insight) =>
        total +
        insight.reviewFlags.length +
        insight.extracted.fields.filter((field) => field.needs_review).length,
      0,
    );
    const fromHandovers = handovers[0]?.reviewFlags.length ?? 0;
    return fromInsights + fromHandovers;
  }, [insights, handovers]);

  const tabs = useMemo<TabDef[]>(
    () => [
      { id: "overview", label: "Overview" },
      { id: "notes", label: "Care notes", count: notes.length },
      { id: "documents", label: "Documents", count: documents.length },
      { id: "ai", label: "AI assistant", count: insights.length + handovers.length },
    ],
    [notes.length, documents.length, insights.length, handovers.length],
  );

  const photoUrls = useResidentPhotoUrls([resident?.photo_path]);

  if (loadingResident) {
    return <LoadingPanel label="Loading resident record…" />;
  }

  if (!resident) {
    return (
      <EmptyState
        icon={<TriangleAlert aria-hidden="true" className="size-5" />}
        title="We couldn't open that record"
        description={residentError ?? "This resident may have been removed from the register."}
        action={
          <Link to="/residents">
            <Button variant="secondary" icon={<ArrowLeft aria-hidden="true" className="size-4" />}>
              Back to residents
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/residents"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-primary"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All residents
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <ResidentPhotoControl
            resident={resident}
            photoUrl={resident.photo_path ? (photoUrls.get(resident.photo_path) ?? null) : null}
            onUpdated={setResident}
          />
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">{resident.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {resident.room_number ? (
                <Badge tone="neutral" icon={<DoorOpen aria-hidden="true" className="size-3" />}>
                  Room {resident.room_number}
                </Badge>
              ) : null}
              <Badge tone="neutral">{formatAge(resident.dob)}</Badge>
              <Badge tone="neutral" icon={<CalendarDays aria-hidden="true" className="size-3" />}>
                Admitted {formatDate(resident.admission_date)}
              </Badge>
            </div>
          </div>
        </div>

        {isAdmin ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<Pencil aria-hidden="true" className="size-4" />}
              onClick={() => setEditOpen(true)}
            >
              Edit details
            </Button>
            <Button
              variant="secondary"
              icon={<Trash2 aria-hidden="true" className="size-4" />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </header>

      {reviewCount > 0 ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning-soft px-4 py-3"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {reviewCount} item{reviewCount === 1 ? "" : "s"} need a person to check
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              The AI assistant flagged these in its extractions or handover brief.{" "}
              <button
                type="button"
                onClick={() => setTab("ai")}
                className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
              >
                Review them in the AI assistant tab
              </button>
              .
            </p>
          </div>
        </div>
      ) : null}

      <Tabs tabs={tabs} value={tab} onValueChange={(id) => setTab(id as TabId)} label="Resident record sections" />

      <TabPanel id="overview" value={tab}>
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Resident details"
              description="The core record. Care-plan documents and the AI extraction live in their own tabs."
            />
            <CardBody>
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <Detail label="Date of birth" value={formatDate(resident.dob)} />
                <Detail label="Room" value={resident.room_number || "Not recorded"} />
                <Detail label="Admitted" value={formatDate(resident.admission_date)} />
                <Detail
                  label="Record added"
                  value={
                    <time dateTime={resident.created_at} title={formatDateTime(resident.created_at)}>
                      {formatDateTime(resident.created_at)}
                    </time>
                  }
                />
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Care needs summary
                  </dt>
                  <dd className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {resident.care_needs || "No care needs summary recorded yet."}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <ContactsPanel
            residentId={resident.id}
            contacts={contacts}
            loading={panelsLoading}
            onChanged={refreshPanels}
          />

          <Card>
            <CardHeader
              title="Recent care notes"
              description={
                notes.length === 0
                  ? "Nothing recorded yet."
                  : `The last ${Math.min(3, notes.length)} of ${notes.length}.`
              }
              icon={<NotebookText aria-hidden="true" className="size-4" />}
              action={
                <Button size="sm" variant="secondary" onClick={() => setTab("notes")}>
                  Open timeline
                </Button>
              }
            />
            <CardBody className="p-0">
              {panelsLoading ? (
                <LoadingPanel label="Loading notes…" />
              ) : notes.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<NotebookText aria-hidden="true" className="size-5" />}
                    title="No care notes yet"
                    description={`Record the first observation about ${resident.name} — it becomes the raw material for the shift-handover brief.`}
                    action={
                      <Button size="sm" onClick={() => setTab("notes")}>
                        Add a care note
                      </Button>
                    }
                    className="border-0 bg-transparent py-6"
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {notes.slice(0, 3).map((note) => (
                    <li key={note.id} className="flex gap-3 px-5 py-3.5">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold text-muted-foreground"
                      >
                        {initials(note.author_id ? (staffNames.get(note.author_id) ?? "Staff member") : "Staff member")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          <time dateTime={note.created_at}>{relativeTime(note.created_at)}</time>
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-sm whitespace-pre-wrap text-foreground">
                          {note.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel id="notes" value={tab}>
        <div className="space-y-5">
          <CareNotesPanel
            residentId={resident.id}
            residentName={resident.name}
            notes={notes}
            staffNames={staffNames}
            loading={panelsLoading}
            onChanged={refreshPanels}
          />

          <HandoverPanel
            residentId={resident.id}
            residentName={resident.name}
            noteCount={notes.length}
            handovers={handovers}
            loading={panelsLoading}
            onGenerated={refreshPanels}
          />
        </div>
      </TabPanel>

      <TabPanel id="documents" value={tab}>
        <DocumentsPanel
          residentId={resident.id}
          documents={documents}
          insights={insights}
          loading={panelsLoading}
          onChanged={refreshPanels}
        />
      </TabPanel>

      <TabPanel id="ai" value={tab}>
        <div className="space-y-5">
          <InsightsPanel insights={insights} loading={panelsLoading} />
          <HandoverPanel
            residentId={resident.id}
            residentName={resident.name}
            noteCount={notes.length}
            handovers={handovers}
            loading={panelsLoading}
            onGenerated={refreshPanels}
          />
        </div>
      </TabPanel>

      <ResidentFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        resident={resident}
        onSaved={(updated) => setResident(updated)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${resident.name}?`}
        description={`This removes the resident, their care notes, emergency contacts and the links to their documents. This can't be undone.`}
        confirmLabel="Delete resident"
        onConfirm={async () => {
          const result = await deleteResident(resident.id);
          if (result.error) {
            toast.error("Resident not deleted", result.error);
            return;
          }
          toast.success(`${resident.name} removed`, "The record and its notes are gone from the register.");
          navigate("/residents", { replace: true });
        }}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
