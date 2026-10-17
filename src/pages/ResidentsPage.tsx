import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ChevronRight,
  Plus,
  Search,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { listResidents, type ResidentRow } from "../lib/data";
import { formatAge, formatDate } from "../lib/format";
import { useResidentPhotoUrls } from "../lib/photoUrls";
import { cn } from "../lib/utils";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingPanel, Spinner } from "../components/ui/Spinner";
import { ResidentAvatar } from "../components/residents/ResidentAvatar";
import { ResidentFormDialog } from "../components/residents/ResidentFormDialog";

export function ResidentsPage() {
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [residents, setResidents] = useState<ResidentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (term: string) => {
    setBusy(true);
    const result = await listResidents(term);
    setResidents(result.data);
    setError(result.error);
    setBusy(false);
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    void load(debounced);
  }, [debounced, load]);

  const searching = debounced.trim().length > 0;
  const list = residents ?? [];
  const photoUrls = useResidentPhotoUrls(list.map((resident) => resident.photo_path));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Residents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {residents === null
              ? "Loading the register…"
              : searching
                ? `${list.length} ${list.length === 1 ? "match" : "matches"} for “${debounced.trim()}”`
                : `${list.length} ${list.length === 1 ? "resident" : "residents"} on file`}
          </p>
        </div>

        {isAdmin ? (
          <Button
            onClick={() => setFormOpen(true)}
            icon={<Plus aria-hidden="true" className="size-4" />}
          >
            Add resident
          </Button>
        ) : null}
      </header>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <label htmlFor="resident-search" className="sr-only">
          Search residents by name or room number
        </label>
        <input
          id="resident-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or room…"
          className={cn(
            "h-10 w-full rounded-lg border border-border-strong bg-surface pr-10 pl-9 text-sm text-foreground",
            "placeholder:text-muted-foreground/70 transition-colors duration-150 ease-out",
            "hover:border-primary/45 focus:border-primary",
          )}
        />
        <span className="absolute top-1/2 right-2.5 -translate-y-1/2">
          {busy && !initialLoading ? (
            <Spinner label="Searching residents" className="text-muted-foreground" />
          ) : search ? (
            <IconButton
              label="Clear search"
              icon={<X aria-hidden="true" className="size-4" />}
              onClick={() => setSearch("")}
            />
          ) : null}
        </span>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive-soft">
          <CardBody className="flex items-start gap-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">We couldn't load the register</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void load(debounced)}>
              Try again
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {!error && initialLoading ? <LoadingPanel label="Loading residents…" /> : null}

      {!error && !initialLoading && list.length === 0 ? (
        searching ? (
          <EmptyState
            icon={<UserRoundSearch aria-hidden="true" className="size-5" />}
            title={`No resident matches “${debounced.trim()}”`}
            description="Try a shorter search, or check the room number. Searching covers both the name and the room."
            action={
              <Button variant="secondary" onClick={() => setSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Users aria-hidden="true" className="size-5" />}
            title="No residents on file yet"
            description={
              isAdmin
                ? "Add the first resident and you can attach care notes, emergency contacts and care-plan documents straight away."
                : "Once an administrator adds residents, they'll appear here and you can start recording care notes."
            }
            action={
              isAdmin ? (
                <Button
                  onClick={() => setFormOpen(true)}
                  icon={<Plus aria-hidden="true" className="size-4" />}
                >
                  Add the first resident
                </Button>
              ) : undefined
            }
          />
        )
      ) : null}

      {!error && list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((resident, index) => (
            <li
              key={resident.id}
              style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              className="motion-safe:animate-[rise_240ms_ease-out] [animation-fill-mode:backwards]"
            >
              <Link
                to={`/residents/${resident.id}`}
                className="group flex items-center gap-4 rounded-card border border-border bg-surface px-4 py-3.5 shadow-card transition-colors duration-150 ease-out hover:border-primary/35 hover:bg-primary/5 motion-safe:active:scale-[0.995]"
              >
                <ResidentAvatar
                  name={resident.name}
                  photoUrl={resident.photo_path ? (photoUrls.get(resident.photo_path) ?? null) : null}
                  size="sm"
                  className="transition-colors duration-150 group-hover:bg-primary/10 group-hover:text-primary"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{resident.name}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {formatAge(resident.dob)}
                    <span aria-hidden="true"> · </span>
                    Admitted {formatDate(resident.admission_date)}
                  </p>
                </div>

                {resident.room_number ? (
                  <Badge tone="neutral" className="tabular-nums">
                    Room {resident.room_number}
                  </Badge>
                ) : null}

                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <ResidentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load(debounced)}
      />
    </div>
  );
}
