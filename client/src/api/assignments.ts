import { apiRequest } from "./client";
import type { Assignment, Submission } from "../types";

export function createAssignment(payload: {
  courseId: string;
  title: string;
  description: string;
  dueDate: string | null;
  pointsPossible: number;
}): Promise<Assignment> {
  return apiRequest("/assignments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAssignmentSubmissions(
  assignmentId: string
): Promise<Submission[]> {
  return apiRequest(`/assignments/${assignmentId}/submissions`);
}

export function deleteAssignment(assignmentId: string): Promise<void> {
  return apiRequest(`/assignments/${assignmentId}`, {
    method: "DELETE",
  });
}