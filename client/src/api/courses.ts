import { apiRequest } from "./client";
import type { Assignment, Course, Student } from "../types";

export function getCourses(): Promise<Course[]> {
  return apiRequest("/courses");
}

export function createCourse(payload: {
  title: string;
  description: string;
  courseCode: string;
  teacherId: string;
}): Promise<Course> {
  return apiRequest("/courses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCourse(
  courseId: string,
  payload: {
    title: string;
    description: string;
    courseCode: string;
    teacherId: string;
  }
): Promise<Course> {
  return apiRequest(`/courses/${courseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCourse(courseId: string): Promise<void> {
  return apiRequest(`/courses/${courseId}`, {
    method: "DELETE",
  });
}

export function getCourseAssignments(courseId: string): Promise<Assignment[]> {
  return apiRequest(`/courses/${courseId}/assignments`);
}

export function getCourseStudents(courseId: string): Promise<Student[]> {
  return apiRequest(`/courses/${courseId}/students`);
}