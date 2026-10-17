import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  createResident,
  updateResident,
  type ResidentInput,
  type ResidentRow,
} from "../../lib/data";
import { TextAreaField, TextField } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

interface ResidentFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (resident: ResidentRow, mode: "created" | "updated") => void;
  resident?: ResidentRow | null;
}

interface FormState {
  name: string;
  room_number: string;
  dob: string;
  admission_date: string;
  care_needs: string;
}

const EMPTY: FormState = {
  name: "",
  room_number: "",
  dob: "",
  admission_date: "",
  care_needs: "",
};

function toFormState(resident?: ResidentRow | null): FormState {
  if (!resident) return EMPTY;
  return {
    name: resident.name,
    room_number: resident.room_number ?? "",
    dob: resident.dob ?? "",
    admission_date: resident.admission_date ?? "",
    care_needs: resident.care_needs ?? "",
  };
}

export function ResidentFormDialog({
  open,
  onClose,
  onSaved,
  resident,
}: ResidentFormDialogProps) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => toFormState(resident));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset whenever the dialog opens for a different record.
  useEffect(() => {
    if (open) {
      setForm(toFormState(resident));
      setErrors({});
    }
  }, [open, resident]);

  const editing = Boolean(resident);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    const today = new Date().toISOString().slice(0, 10);

    if (!form.name.trim()) next.name = "A resident needs a name so staff can find them.";
    else if (form.name.trim().length > 120) next.name = "Please keep the name under 120 characters.";

    if (form.dob && form.dob > today) next.dob = "Date of birth can't be in the future.";
    if (form.admission_date && form.admission_date > today) {
      next.admission_date = "Admission date can't be in the future.";
    }
    if (form.dob && form.admission_date && form.admission_date < form.dob) {
      next.admission_date = "Admission can't be before the date of birth.";
    }
    if (form.care_needs.length > 4000) {
      next.care_needs = "That's longer than we can store — keep it under 4000 characters.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    const payload: ResidentInput = {
      name: form.name.trim(),
      room_number: form.room_number.trim() || null,
      dob: form.dob || null,
      admission_date: form.admission_date || null,
      care_needs: form.care_needs.trim() || null,
    };

    setSubmitting(true);
    const result = editing && resident
      ? await updateResident(resident.id, payload)
      : await createResident(payload);
    setSubmitting(false);

    if (result.error || !result.data) {
      toast.error(editing ? "Changes not saved" : "Resident not added", result.error ?? undefined);
      return;
    }

    toast.success(
      editing ? "Resident updated" : `${result.data.name} added`,
      editing ? "The record now shows your changes." : "You can add care notes and documents now.",
    );
    onSaved(result.data, editing ? "updated" : "created");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={editing ? "Edit resident details" : "Add a resident"}
      description={
        editing
          ? "Update the record. Care notes and documents are kept as they are."
          : "Only the name is required — you can fill in the rest as it becomes available."
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="resident-form" loading={submitting}>
            {editing ? "Save changes" : "Add resident"}
          </Button>
        </>
      }
    >
      <form id="resident-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <TextField
          id="resident-name"
          label="Full name"
          required
          value={form.name}
          onChange={(event) => set("name", event.target.value)}
          placeholder="e.g. Maria Rossi"
          error={errors.name ?? null}
          autoFocus
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="resident-room"
            label="Room number"
            optional
            value={form.room_number}
            onChange={(event) => set("room_number", event.target.value)}
            placeholder="e.g. 12B"
            hint="Free text — matches how your home labels rooms."
          />
          <TextField
            id="resident-dob"
            label="Date of birth"
            optional
            type="date"
            value={form.dob}
            onChange={(event) => set("dob", event.target.value)}
            error={errors.dob ?? null}
          />
        </div>

        <TextField
          id="resident-admission"
          label="Admission date"
          optional
          type="date"
          value={form.admission_date}
          onChange={(event) => set("admission_date", event.target.value)}
          error={errors.admission_date ?? null}
        />

        <TextAreaField
          id="resident-care-needs"
          label="Care needs summary"
          optional
          value={form.care_needs}
          onChange={(event) => set("care_needs", event.target.value)}
          rows={4}
          placeholder="Mobility, dietary requirements, communication preferences…"
          hint="A short human summary. The AI reads uploaded care-plan documents separately."
          error={errors.care_needs ?? null}
        />
      </form>
    </Modal>
  );
}
