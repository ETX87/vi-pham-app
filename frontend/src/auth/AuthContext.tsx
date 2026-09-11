import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppUser } from "../types";

// Rut gon tu linh-kien-app frontend/src/auth/AuthContext.tsx - khong co "xem thu vai tro" (chi
// Admin/KTV thuong o he nay).
type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "pending" }
  | { status: "rejected" }
  | { status: "disabled" }
  | { status: "authenticated"; user: AppUser };

interface AuthContextValue {
  state: AuthState;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  async function load(cancelledRef?: { current: boolean }) {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (cancelledRef?.current) return;
      if (res.ok) {
        const { user } = (await res.json()) as { user: AppUser };
        setState({ status: "authenticated", user });
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === "PENDING_APPROVAL") setState({ status: "pending" });
      else if (body.error === "REJECTED") setState({ status: "rejected" });
      else if (body.error === "DISABLED") setState({ status: "disabled" });
      else setState({ status: "anonymous" });
    } catch {
      if (!cancelledRef?.current) setState({ status: "anonymous" });
    }
  }

  useEffect(() => {
    const cancelledRef = { current: false };
    load(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return <AuthContext.Provider value={{ state, refreshUser: () => load() }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phai dung trong AuthProvider");
  return ctx.state;
}

export function useRefreshUser() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useRefreshUser phai dung trong AuthProvider");
  return ctx.refreshUser;
}
