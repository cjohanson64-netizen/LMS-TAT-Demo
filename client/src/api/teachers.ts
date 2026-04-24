import { apiRequest } from "./client";
import type { Gender, Teacher } from "../types";

type TeacherPayload = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  email: string;
  primaryAddress: string | null;
  secondaryAddress: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
};

export function getTeachers(): Promise<Teacher[]> {
  return apiRequest("/teachers");
}

export function createTeacher(payload: TeacherPayload & {
  temporaryPassword: string;
}): Promise<Teacher> {
  return apiRequest("/teachers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTeacher(
  teacherId: string,
  payload: TeacherPayload
): Promise<Teacher> {
  return apiRequest(`/teachers/${teacherId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteTeacher(teacherId: string): Promise<void> {
  return apiRequest(`/teachers/${teacherId}`, {
    method: "DELETE",
  });
}

export function resetTeacherPassword(
  teacherId: string,
  payload: { password: string; confirmPassword: string }
): Promise<{ message: string }> {
  return apiRequest(`/teachers/${teacherId}/reset-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
