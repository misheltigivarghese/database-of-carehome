import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  HeartPulse,
  Lock,
  MailCheck,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/Field";

interface LocationState {
  from?: string;
}

type Mode = "sign-in" | "setup";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInPage() {
  const { session, initialising, signIn, signUp } = useAuth();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (!initialising && session) {
    const target = (location.state as LocationState | null)?.from;
    return <Navigate to={target && target !== "/sign-in" ? target : "/residents"} replace />;
  }

  function switchMode(next: Mode) {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
    setConfirmationSent(false);
    setPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: typeof fieldErrors = {};
    const trimmedEmail = email.trim();

    if (mode === "setup") {
      if (!name.trim()) {
        nextErrors.name = "Add your name — care notes and handover briefs are signed with it.";
      } else if (name.trim().length > 80) {
        nextErrors.name = "Please keep your name under 80 characters.";
      }
    }

    if (!trimmedEmail) {
      nextErrors.email = "Enter your work email address.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "That doesn't look like an email address — check for typos.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    } else if (mode === "setup" && password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    if (mode === "setup") {
      const { error, needsConfirmation } = await signUp({
        name: name.trim(),
        email: trimmedEmail,
        password,
      });
      setSubmitting(false);

      if (error) {
        setFormError(error);
        return;
      }
      if (needsConfirmation) {
        // The project requires email confirmation before the account is usable.
        setConfirmationSent(true);
        return;
      }
      // A session was returned, so the auth listener signs us in and redirects.
      return;
    }

    const { error } = await signIn(trimmedEmail, password);
    setSubmitting(false);

    if (error) {
      setFormError(error);
      setPassword("");
    }
  }

  const settingUp = mode === "setup";

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <aside className="hidden flex-col justify-between border-r border-border bg-surface p-10 lg:flex lg:w-[46%] xl:p-14">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-on-primary">
            <HeartPulse aria-hidden="true" className="size-5" />
          </span>
          <span className="font-heading text-base font-semibold text-foreground">
            Resident Records
          </span>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="font-heading text-3xl leading-tight font-semibold text-foreground">
            The right detail, at the right moment, for every resident.
          </h1>
          <p className="text-base text-muted-foreground">
            One place for care plans, care notes and handover — with an AI assistant that
            reads long documents and flags exactly what a person still needs to check.
          </p>
          <ul className="space-y-3">
            {[
              { icon: ShieldCheck, text: "Access limited by role, enforced in the database." },
              { icon: Lock, text: "Care documents stored privately, shared via links that expire." },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-muted-foreground">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Internal use only · AI output is assistive, never a diagnosis
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-on-primary">
              <HeartPulse aria-hidden="true" className="size-5" />
            </span>
            <span className="font-heading text-base font-semibold text-foreground">
              Resident Records
            </span>
          </div>

          {confirmationSent ? (
            <div className="space-y-5">
              <span className="flex size-11 items-center justify-center rounded-full bg-success-soft text-success">
                <MailCheck aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="font-heading text-2xl font-semibold text-foreground">
                  Almost there
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  We've sent a confirmation link to{" "}
                  <span className="font-medium text-foreground">{email.trim()}</span>. Open it to
                  activate your account, then sign in here.
                </p>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => switchMode("sign-in")}
                icon={<ArrowLeft aria-hidden="true" className="size-4" />}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h2 className="font-heading text-2xl font-semibold text-foreground">
                {settingUp ? "Set up this care home" : "Staff sign in"}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {settingUp
                  ? "Create the first account. It becomes the administrator, so you can add the rest of the team afterwards."
                  : "Use the work account your administrator set up for you."}
              </p>

              {formError ? (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-3 rounded-card border border-destructive/30 bg-destructive-soft px-4 py-3"
                >
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                  />
                  <p className="text-sm text-foreground">{formError}</p>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
                {settingUp ? (
                  <TextField
                    id="setup-name"
                    label="Your full name"
                    required
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setFormError(null);
                    }}
                    autoComplete="name"
                    autoFocus
                    placeholder="e.g. Giulia Ferrari"
                    hint="Used to sign the care notes you write."
                    error={fieldErrors.name ?? null}
                  />
                ) : null}

                <TextField
                  id="sign-in-email"
                  label="Work email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFormError(null);
                  }}
                  autoComplete="email"
                  autoFocus={!settingUp}
                  placeholder="you@carehome.it"
                  error={fieldErrors.email ?? null}
                />

                <TextField
                  id="sign-in-password"
                  label="Password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFormError(null);
                  }}
                  autoComplete={settingUp ? "new-password" : "current-password"}
                  hint={settingUp ? "At least 8 characters." : undefined}
                  error={fieldErrors.password ?? null}
                />

                <Button type="submit" loading={submitting} className="w-full">
                  {settingUp ? "Create administrator account" : "Sign in"}
                </Button>
              </form>

              <div className="mt-6 border-t border-border pt-5">
                {settingUp ? (
                  <button
                    type="button"
                    onClick={() => switchMode("sign-in")}
                    className="cursor-pointer text-sm font-medium text-primary underline-offset-2 transition-colors duration-150 hover:underline"
                  >
                    I already have an account — sign in
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => switchMode("setup")}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 transition-colors duration-150 hover:underline"
                    >
                      <UserPlus aria-hidden="true" className="size-3.5" />
                      Setting this care home up for the first time?
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Trouble signing in? Ask an administrator to confirm your account and role.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
