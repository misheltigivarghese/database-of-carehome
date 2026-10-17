import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

type Tone = "success" | "error" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: Tone;
}

interface ToastContextValue {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONE_STYLES: Record<Tone, string> = {
  success: "border-success/35 bg-success-soft text-success",
  error: "border-destructive/35 bg-destructive-soft text-destructive",
  info: "border-primary/25 bg-primary/10 text-primary",
};

const TONE_ICON: Record<Tone, ReactNode> = {
  success: <CheckCircle2 aria-hidden="true" className="size-4" />,
  error: <AlertTriangle aria-hidden="true" className="size-4" />,
  info: <Info aria-hidden="true" className="size-4" />,
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, title: string, description?: string) => {
      const id = newId();
      setToasts((current) => [...current, { id, title, description, tone }]);
      timers.current.push(window.setTimeout(() => dismiss(id), 6000));
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (title, description) => push("success", title, description),
      error: (title, description) => push("error", title, description),
      info: (title, description) => push("info", title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-card border bg-surface px-4 py-3 shadow-pop",
              "motion-safe:animate-[pop-in_180ms_cubic-bezier(0.16,1,0.3,1)]",
            )}
          >
            <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border", TONE_STYLES[toast.tone])}>
              {TONE_ICON[toast.tone]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}
