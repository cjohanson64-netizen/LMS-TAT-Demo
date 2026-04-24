import { apiRequest } from "./client";
import type {
  AssignmentStatusProjection,
  TatSubmissionResponse,
  CourseAssignmentSummaryProjection,
} from "../types";

export function getTatSubmission(submissionId: string) {
  return apiRequest<TatSubmissionResponse>(`/tat/submission/${submissionId}`);
}

export function getAssignmentStatus(
  assignmentId: string
): Promise<AssignmentStatusProjection> {
  return apiRequest(`/tat/assignments/${assignmentId}/status`);
}

export function getCourseAssignmentSummary(courseId: string) {
  return apiRequest<CourseAssignmentSummaryProjection>(
    `/tat/courses/${courseId}/assignment-summary`
  );
}