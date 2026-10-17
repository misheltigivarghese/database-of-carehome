import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type Role = "admin" | "care_staff";

export interface Profile {
  user_id: string;
  name: string | null;
  role: Role;
  created_at: string;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  role: Role;
  isAdmin: boolean;
  displayName: string;
  initialising: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Supabase returns raw auth strings — never show those to care staff. */
function friendlyAuthError(message: string): string {
  const normalised = message.toLowerCase();
  if (normalised.includes("invalid login credentials")) {
    return "That email and password don't match. Please check both and try again.";
  }
  if (normalised.includes("email not confirmed")) {
    return "This account hasn't been confirmed yet. Check the invitation email, or ask an administrator.";
  }
  if (normalised.includes("rate limit") || normalised.includes("too many")) {
    return "Too many attempts just now. Wait a moment and try again.";
  }
  if (normalised.includes("failed to fetch") || normalised.includes("network")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return "We couldn't sign you in. Please try again.";
}

/** Same idea for first-time setup. */
function friendlySignUpError(message: string): string {
  const normalised = message.toLowerCase();
  if (normalised.includes("already registered") || normalised.includes("already exists")) {
    return "An account with that email already exists — sign in instead.";
  }
  if (normalised.includes("password should be at least")) {
    return "Use a password of at least 8 characters.";
  }
  if (normalised.includes("unable to validate email") || normalised.includes("invalid email")) {
    return "That email address doesn't look valid — check for typos.";
  }
  if (normalised.includes("rate limit") || normalised.includes("too many")) {
    return "Too many attempts just now. Wait a moment and try again.";
  }
  if (normalised.includes("failed to fetch") || normalised.includes("network")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return "We couldn't create that account. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, name, role, created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setProfileError("We couldn't load your staff profile. Please refresh the page.");
      return;
    }

    if (!data) {
      setProfile(null);
      setProfileError(
        "Your sign-in worked, but there's no staff profile linked to this account yet. Ask an administrator to set up your access.",
      );
      return;
    }

    setProfileError(null);
    setProfile(data as Profile);
  }, []);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      if (active) setInitialising(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        void loadProfile(next.user.id);
      } else {
        setProfile(null);
        setProfileError(null);
      }
      setInitialising(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error ? friendlyAuthError(error.message) : null };
  }, []);

  const signUp = useCallback(
    async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // The `handle_new_user` trigger reads this and assigns the role
          // server-side; the client is never trusted with a role.
          data: { name: name.trim() },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        return { error: friendlySignUpError(error.message), needsConfirmation: false };
      }
      // No session means the project requires email confirmation first.
      return { error: null, needsConfirmation: !data.session };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) await loadProfile(data.session.user.id);
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const role: Role = profile?.role === "admin" ? "admin" : "care_staff";
    const emailName = session?.user?.email?.split("@")[0] ?? "";
    return {
      session,
      profile,
      role,
      isAdmin: role === "admin",
      displayName: profile?.name?.trim() || emailName || "Staff member",
      initialising,
      profileError,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    };
  }, [session, profile, initialising, profileError, signIn, signUp, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}
