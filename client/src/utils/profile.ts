import type { Student, Teacher } from "../types";

export function getStudentFullName(student: Student): string {
  return formatFullName(student.firstName, student.middleName, student.lastName);
}

export function getTeacherFullName(teacher: Teacher): string {
  return formatFullName(teacher.firstName, teacher.middleName, teacher.lastName);
}

function formatFullName(
  firstName: string,
  middleName: string | null,
  lastName: string
): string {
  return [firstName, middleName, lastName].filter(Boolean).join(" ");
}
