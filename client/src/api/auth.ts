import { apiRequest } from "./client";
import type { AuthUser } from "../types";
import type { UserRole } from "../types";

export function login(email: string, password: string): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
  });
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me");
}

export function startViewAs(payload: {
  role: Exclude<UserRole, "ADMIN">;
  linkedEntityId: string;
}): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/view-as", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function stopViewAs(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/stop-view-as", {
    method: "POST",
  });
}

export function changePassword(payload: {
  password: string;
  confirmPassword: string;
}): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
