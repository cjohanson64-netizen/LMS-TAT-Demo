import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import { getStudents } from "../../api/students";
import { getCourses } from "../../api/courses";
import { createEnrollment } from "../../api/enrollments";
import type { Student, Course } from "../../types";
import { useDataRefresh } from "../../data/useDataRefresh";
import { getStudentFullName } from "../../utils/profile";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

export default function EnrollmentSection() {
  const { versions, refresh } = useDataRefresh();
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const isFormValid =
    studentId.trim().length > 0 && courseId.trim().length > 0;

  useEffect(() => {
    Promise.all([getStudents(), getCourses()])
      .then(([studentData, courseData]) => {
        setStudents(studentData);
        setCourses(courseData);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [versions.students, versions.courses]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isFormValid) {
      return;
    }

    try {
      await createEnrollment({
        studentId: studentId.trim(),
        courseId: courseId.trim(),
      });
      setSuccessMessage("Student enrolled successfully.");
      setStudentId("");
      setCourseId("");
      refresh("enrollments");
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  return (
    <SectionCard title="Enrollments">
      <form onSubmit={handleSubmit} className="form-grid">
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="">Select student</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {getStudentFullName(student)}
            </option>
          ))}
        </select>

        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title} ({course.courseCode})
            </option>
          ))}
        </select>

        <button type="submit" disabled={!isFormValid}>
          Enroll Student
        </button>
      </form>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />
    </SectionCard>
  );
}
