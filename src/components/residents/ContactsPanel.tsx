import { useState } from "react";
import type { FormEvent } from "react";
import { Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import {
  createContact,
  deleteContact,
  updateContact,
  type ContactInput,
  type ContactRow,
} from "../../lib/data";
import { Button, IconButton } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { TextField } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { LoadingPanel } from "../ui/Spinner";
import { useToast } from "../ui/Toast";

interface ContactsPanelProps {
  residentId: string;
  contacts: ContactRow[];
  loading: boolean;
  onChanged: () => void;
}

interface ContactFormState {
  name: string;
  relationship: string;
  phone: string;
}

const EMPTY: ContactFormState = { name: "", relationship: "", phone: "" };

export function ContactsPanel({ residentId, contacts, loading, onChanged }: ContactsPanelProps) {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [form, setForm] = useState<ContactFormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ContactRow | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(contact: ContactRow) {
    setEditing(contact);
    setForm({
      name: contact.name,
      relationship: contact.relationship ?? "",
      phone: contact.phone ?? "",
    });
    setErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next: Partial<Record<keyof ContactFormState, string>> = {};
    const phone = form.phone.trim();

    if (!form.name.trim()) next.name = "A contact needs a name.";
    if (phone && !/^[+()\d][\d\s().-]{4,}$/.test(phone)) {
      next.phone = "That doesn't look like a phone number — digits, spaces and + ( ) - only.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload: ContactInput = {
      name: form.name.trim(),
      relationship: form.relationship.trim() || null,
      phone: phone || null,
    };

    setSaving(true);
    const result =
      editing && editing.id
        ? await updateContact(editing.id, payload)
        : await createContact(residentId, payload);
    setSaving(false);

    if (result.error) {
      toast.error(editing ? "Contact not saved" : "Contact not added", result.error);
      return;
    }

    toast.success(
      editing ? "Contact updated" : "Contact added",
      `${payload.name} will appear on this resident's record.`,
    );
    setFormOpen(false);
    onChanged();
  }

  return (
    <Card>
      <CardHeader
        title="Emergency contacts"
        description="Who to call, and in what order."
        icon={<Phone aria-hidden="true" className="size-4" />}
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={openCreate}
            icon={<Plus aria-hidden="true" className="size-4" />}
          >
            Add contact
          </Button>
        }
      />

      <CardBody className="p-0">
        {loading ? (
          <LoadingPanel label="Loading contacts…" />
        ) : contacts.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<UserRound aria-hidden="true" className="size-5" />}
              title="No emergency contacts yet"
              description="Add the people to contact in an emergency, starting with the first person to call."
              action={
                <Button size="sm" onClick={openCreate} icon={<Plus aria-hidden="true" className="size-4" />}>
                  Add the first contact
                </Button>
              }
              className="border-0 bg-transparent py-6"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{contact.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {contact.relationship || "Relationship not recorded"}
                  </p>
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone.replace(/\s/g, "")}`}
                      className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 transition-colors duration-150 hover:underline"
                    >
                      <Phone aria-hidden="true" className="size-3.5" />
                      <span className="tabular-nums">{contact.phone}</span>
                    </a>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">No phone number recorded</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label={`Edit ${contact.name}`}
                    icon={<Pencil aria-hidden="true" className="size-3.5" />}
                    onClick={() => openEdit(contact)}
                  />
                  {isAdmin ? (
                    <IconButton
                      label={`Remove ${contact.name}`}
                      icon={<Trash2 aria-hidden="true" className="size-3.5" />}
                      onClick={() => setPendingDelete(contact)}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <Modal
        open={formOpen}
        onClose={saving ? () => undefined : () => setFormOpen(false)}
        title={editing ? "Edit emergency contact" : "Add emergency contact"}
        description="Contacts appear on the resident's record so staff can reach someone quickly."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="contact-form" loading={saving}>
              {editing ? "Save contact" : "Add contact"}
            </Button>
          </>
        }
      >
        <form id="contact-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
          <TextField
            id="contact-name"
            label="Name"
            required
            autoFocus
            value={form.name}
            onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
            placeholder="e.g. Luca Rossi"
            error={errors.name ?? null}
          />
          <TextField
            id="contact-relationship"
            label="Relationship"
            optional
            value={form.relationship}
            onChange={(event) => setForm((c) => ({ ...c, relationship: event.target.value }))}
            placeholder="e.g. Son, GP, Power of attorney"
          />
          <TextField
            id="contact-phone"
            label="Phone number"
            optional
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => setForm((c) => ({ ...c, phone: event.target.value }))}
            placeholder="e.g. +39 333 123 4567"
            error={errors.phone ?? null}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Remove this contact?"
        description={
          pendingDelete
            ? `${pendingDelete.name} will no longer appear on this resident's record. This can't be undone.`
            : ""
        }
        confirmLabel="Remove contact"
        onConfirm={async () => {
          if (!pendingDelete) return;
          const result = await deleteContact(pendingDelete.id);
          if (result.error) {
            toast.error("Contact not removed", result.error);
            return;
          }
          toast.success("Contact removed", `${pendingDelete.name} is no longer listed.`);
          onChanged();
        }}
      />
    </Card>
  );
}
