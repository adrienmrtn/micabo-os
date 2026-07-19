import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";

export type Role = "admin" | "poster";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  account_setup_done: boolean;
  is_active: boolean;
  locale: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  role: Role | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => void;
}

const AuthContext = React.createContext<AuthState | undefined>(undefined);

/**
 * Roles live in their own table, never on the profile — a role column on a
 * self-editable row would be a privilege escalation waiting to happen. An
 * admin row wins over a poster row if somehow both exist.
 */
async function fetchRole(userId: string): Promise<Role | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = (data ?? []).map((row) => row.role as Role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("poster")) return "poster";
  return null;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, account_setup_done, is_active, locale")
    .eq("id", userId)
    .single();

  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Omit<AuthState, "refresh">>({
    session: null,
    user: null,
    role: null,
    profile: null,
    loading: true,
  });
  const [reloadToken, setReloadToken] = React.useState(0);

  const refresh = React.useCallback(() => setReloadToken((n) => n + 1), []);

  React.useEffect(() => {
    let isMounted = true;

    async function loadFromSession(session: Session | null) {
      if (!session?.user) {
        if (isMounted)
          setState({
            session: null,
            user: null,
            role: null,
            profile: null,
            loading: false,
          });
        return;
      }

      const [role, profile] = await Promise.all([
        fetchRole(session.user.id),
        fetchProfile(session.user.id),
      ]);

      if (isMounted)
        setState({ session, user: session.user, role, profile, loading: false });
    }

    supabase.auth
      .getSession()
      .then(({ data }) => loadFromSession(data.session))
      .catch(() => {
        if (isMounted)
          setState({
            session: null,
            user: null,
            role: null,
            profile: null,
            loading: false,
          });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        loadFromSession(session);
      },
    );

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [reloadToken]);

  const value = React.useMemo(() => ({ ...state, refresh }), [state, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
