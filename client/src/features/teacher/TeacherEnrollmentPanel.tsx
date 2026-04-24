import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import { getCourseStudents } from "../../api/courses";
import type { Course, Student } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { getStudentFullName } from "../../utils/profile";

type Props = {
  course: Course;
};

export default function TeacherEnrollmentPanel({ course }: Props) {
  const [roster, setRoster] = useState<Student[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getCourseStudents(course.id)
      .then((students) => {
        setRoster(students);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [course.id]);

  return (
    <div>
      <h4>Class Roster</h4>
      <p className="meta-text">
        Students enrolled in <strong>{course.title}</strong>
      </p>

      <ErrorMessage message={error} />

      {roster.length === 0 ? (
        <EmptyState message="No students enrolled yet." />
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
  );
}
