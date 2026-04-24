import { apiRequest } from "./client";
import type { Submission } from "../types";

export function createSubmission(payload: {
  assignmentId: string;
  studentId: string;
  content: string;
}): Promise<Submission> {
  return apiRequest("/submissions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function gradeSubmission(
  submissionId: string,
  payload: { score: number }
): Promise<Submission> {
  return apiRequest(`/submissions/${submissionId}/grade`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getStudentSubmissions(studentId: string): Promise<Submission[]> {
  return apiRequest(`/students/${studentId}/submissions`);
}