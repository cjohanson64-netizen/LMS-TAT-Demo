import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import { getCourses, getCourseStudents } from "../../api/courses";
import { createEnrollment } from "../../api/enrollments";
import { getStudents } from "../../api/students";
import type { Course, Student } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { getStudentFullName } from "../../utils/profile";
import { isNonEmpty } from "../../utils/validation";

export default function AdminEnrollmentsPanel() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [roster, setRoster] = useState<Student[]>([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isFormValid =
    isNonEmpty(selectedStudentId) && isNonEmpty(selectedCourseId);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const [studentData, courseData] = await Promise.all([
          getStudents(),
          getCourses(),
        ]);

        if (isCancelled) {
          return;
        }

        setStudents(studentData);
        setCourses(courseData);
      } catch (error: unknown) {
        if (isCancelled) {
          return;
        }

        setError(getErrorMessage(error));
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!selectedCourseId) {
      return () => {
        isCancelled = true;
      };
    }

    void (async () => {
      try {
        const rosterData = await getCourseStudents(selectedCourseId);

        if (isCancelled) {
          return;
        }

        setRoster(rosterData);
      } catch (error: unknown) {
        if (isCancelled) {
          return;
        }

        setError(getErrorMessage(error));
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [selectedCourseId]);

  const enrolledStudentIds = useMemo(() => {
    return new Set(roster.map((student) => student.id));
  }, [roster]);

  const availableStudents = useMemo(() => {
    return students.filter((student) => !enrolledStudentIds.has(student.id));
  }, [students, enrolledStudentIds]);

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? null;

  async function refreshRoster(courseId: string) {
    try {
      const rosterData = await getCourseStudents(courseId);
      setRoster(rosterData);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  async function handleCreateEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isFormValid) {
      return;
    }

    try {
      await createEnrollment({
        studentId: selectedStudentId,
        courseId: selectedCourseId,
      });

      setSuccessMessage("Enrollment created successfully.");
      setSelectedStudentId("");
      await refreshRoster(selectedCourseId);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  return (
    <div>
      <h4>Enrollments</h4>
      <p className="meta-text">Enroll students into any course.</p>

      <form
        onSubmit={handleCreateEnrollment}
        className="form-grid"
        style={{ marginTop: 16 }}
      >
        <select
          value={selectedCourseId}
          onChange={(e) => {
            const nextCourseId = e.target.value;

            setSelectedCourseId(nextCourseId);
            setSelectedStudentId("");
            setRoster([]);
            setError("");
            setSuccessMessage("");
          }}
        >
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title} ({course.courseCode})
            </option>
          ))}
        </select>

        <select
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(e.target.value)}
          disabled={!selectedCourseId || availableStudents.length === 0}
        >
          <option value="">
            {!selectedCourseId
              ? "Select a course first"
              : availableStudents.length === 0
              ? "All students already enrolled"
              : "Select student"}
          </option>
          {availableStudents.map((student) => (
            <option key={student.id} value={student.id}>
              {getStudentFullName(student)}
            </option>
          ))}
        </select>

        <button type="submit" disabled={!isFormValid}>
          Enroll Student
        </button>
      </form>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <div style={{ marginTop: 20 }}>
        <h4>Selected Course Roster</h4>

        {!selectedCourseId ? (
          <EmptyState message="Select a course to view current enrollments." />
        ) : roster.length === 0 ? (
          <EmptyState
            message={
              selectedCourse
                ? `No students enrolled yet in ${selectedCourse.title}.`
                : "No students enrolled yet."
            }
          />
        ) : (
          <ul className="data-list">
            {roster.map((student) => (
              <li key={student.id}>
                <strong>{getStudentFullName(student)}</strong>
                <br />
                <span>{student.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
