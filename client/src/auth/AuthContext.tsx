import { createContext } from "react";
import type { AuthUser, UserRole } from "../types";

export type AuthContextValue = {
  authUser: AuthUser | null;
  role: UserRole | null;
  realRole: UserRole | null;
  effectiveRole: UserRole | null;
  userId: string;
  linkedEntityId: string | null;
  email: string | null;
  effectiveDisplayName: string | null;
  isImpersonating: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  loginPending: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (payload: {
    password: string;
    confirmPassword: string;
  }) => Promise<void>;
  startViewAs: (payload: {
    role: Exclude<UserRole, "ADMIN">;
    linkedEntityId: string;
  }) => Promise<void>;
  stopViewAs: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
