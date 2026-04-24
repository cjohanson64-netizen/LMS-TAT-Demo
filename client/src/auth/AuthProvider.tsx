import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiRequestError } from "../api/client";
import {
  changePassword as changePasswordRequest,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  startViewAs as startViewAsRequest,
  stopViewAs as stopViewAsRequest,
} from "../api/auth";
import type { AuthUser, UserRole } from "../types";
import { AuthContext, type AuthContextValue } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginPending, setLoginPending] = useState(false);

  const refreshAuth = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setAuthUser(currentUser);
    } catch (error: unknown) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setAuthUser(null);
        return;
      }

      throw error;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refreshAuth();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshAuth]);

  const login = useCallback(async (email: string, password: string) => {
    setLoginPending(true);

    try {
      const currentUser = await loginRequest(email, password);
      setAuthUser(currentUser);
    } finally {
      setLoginPending(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setAuthUser(null);
  }, []);

  const changePassword = useCallback(
    async (payload: { password: string; confirmPassword: string }) => {
      const currentUser = await changePasswordRequest(payload);
      setAuthUser(currentUser);
    },
    []
  );

  const startViewAs = useCallback(
    async (payload: {
      role: Exclude<UserRole, "ADMIN">;
      linkedEntityId: string;
    }) => {
      const currentUser = await startViewAsRequest(payload);
      setAuthUser(currentUser);
    },
    []
  );

  const stopViewAs = useCallback(async () => {
    const currentUser = await stopViewAsRequest();
    setAuthUser(currentUser);
  }, []);

  const realRole: UserRole | null = authUser?.realRole ?? null;
  const effectiveRole: UserRole | null = authUser?.effectiveRole ?? null;
  const role: UserRole | null = effectiveRole;
  const linkedEntityId = authUser?.linkedEntityId ?? null;
  const userId = linkedEntityId ?? authUser?.id ?? "";
  const email = authUser?.email ?? null;
  const effectiveDisplayName = authUser?.effectiveDisplayName ?? null;
  const isImpersonating = authUser?.isImpersonating ?? false;
  const isAuthenticated = authUser !== null;

  const value = useMemo<AuthContextValue>(
    () => ({
      authUser,
      role,
      realRole,
      effectiveRole,
      userId,
      linkedEntityId,
      email,
      effectiveDisplayName,
      isImpersonating,
      isAuthenticated,
      loading,
      loginPending,
      login,
      logout,
      changePassword,
      startViewAs,
      stopViewAs,
      refreshAuth,
    }),
    [
      authUser,
      role,
      realRole,
      effectiveRole,
      userId,
      linkedEntityId,
      email,
      effectiveDisplayName,
      isImpersonating,
      isAuthenticated,
      loading,
      loginPending,
      login,
      logout,
      changePassword,
      startViewAs,
      stopViewAs,
      refreshAuth,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
