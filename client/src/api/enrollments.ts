import { apiRequest } from "./client";

export function createEnrollment(payload: {
  studentId: string;
  courseId: string;
}) {
  return apiRequest("/enrollments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}