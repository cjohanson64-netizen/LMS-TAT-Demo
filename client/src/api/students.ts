import { apiRequest } from "./client";
import type { Gender, Student } from "../types";

type StudentPayload = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  graduationDate: string;
  email: string;
  primaryGuardianFirstName: string;
  primaryGuardianLastName: string;
  secondaryGuardianFirstName: string | null;
  secondaryGuardianLastName: string | null;
  primaryGuardianEmail: string | null;
  secondaryGuardianEmail: string | null;
  primaryAddress: string | null;
  secondaryAddress: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
};

export function getStudents(): Promise<Student[]> {
  return apiRequest("/students");
}

export function createStudent(payload: StudentPayload & {
  temporaryPassword: string;
}): Promise<Student> {
  return apiRequest("/students", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateStudent(
  studentId: string,
  payload: StudentPayload
): Promise<Student> {
  return apiRequest(`/students/${studentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteStudent(studentId: string): Promise<void> {
  return apiRequest(`/students/${studentId}`, {
    method: "DELETE",
  });
}

export function resetStudentPassword(
  studentId: string,
  payload: { password: string; confirmPassword: string }
): Promise<{ message: string }> {
  return apiRequest(`/students/${studentId}/reset-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
