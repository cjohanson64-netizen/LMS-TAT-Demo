import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import ErrorMessage from "../../components/ErrorMessage";
import EmptyState from "../../components/EmptyState";
import { getCourses, getCourseAssignments } from "../../api/courses";
import type { Course, Assignment } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { useDataRefresh } from "../../data/useDataRefresh";

export default function StudentAssignmentSection() {
  const { versions } = useDataRefresh();
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignmentsByCourse, setAssignmentsByCourse] = useState<
    Record<string, Assignment[]>
  >({});
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState("");

  const selectedAssignments = courseId ? (assignmentsByCourse[courseId] ?? []) : [];
  const sortedCourses = useMemo(
    () => [...courses].sort((left, right) => left.courseCode.localeCompare(right.courseCode)),
    [courses]
  );

  useEffect(() => {
    getCourses()
      .then((data) => {
        setCourses(data);
        if (data.length === 0) {
          setAssignmentsByCourse({});
        }
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [versions.courses, versions.enrollments]);

  useEffect(() => {
    if (courses.length === 0) {
      return;
    }

    Promise.all(
      courses.map(async (course) => [
        course.id,
        await getCourseAssignments(course.id),
      ] as const)
    )
      .then((entries) => {
        setAssignmentsByCourse(Object.fromEntries(entries));
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [courses, versions.assignments]);

  return (
    <SectionCard title="Assignments">
      <ErrorMessage message={error} />

      <div className="form-grid">
        <select
          value={courseId}
          onChange={(e) => {
            setError("");
            setCourseId(e.target.value);
          }}
        >
          <option value="">Select course</option>
          {sortedCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title} ({course.courseCode})
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>{courseId ? "Assignments for Selected Course" : "All Assignments"}</h3>

        {!courseId ? (
          sortedCourses.length === 0 ? (
            <EmptyState message="No assignments available." />
          ) : (
            <div className="data-list">
              {sortedCourses.map((course) => {
                const courseAssignments = assignmentsByCourse[course.id] ?? [];

                if (courseAssignments.length === 0) {
                  return null;
                }

                return (
                  <div key={course.id} style={{ marginBottom: 16 }}>
                    <h4>
                      {course.title} ({course.courseCode})
                    </h4>
                    <ul className="data-list">
                      {courseAssignments.map((assignment) => (
                        <li key={assignment.id}>
                          <strong>{assignment.title}</strong> -- {assignment.pointsPossible} points
                          <br />
                          <span>{assignment.description || "No description"}</span>
                          <br />
                          <small>
                            Due:{" "}
                            {assignment.dueDate
                              ? new Date(assignment.dueDate).toLocaleString()
                              : "No due date"}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )
        ) : selectedAssignments.length === 0 ? (
          <EmptyState message="No assignments available." />
        ) : (
          <ul className="data-list">
            {selectedAssignments.map((assignment) => (
              <li key={assignment.id}>
                <strong>{assignment.title}</strong> — {assignment.pointsPossible} points
                <br />
                <span>{assignment.description}</span>
                <br />
                <small>
                  Due:{" "}
                  {assignment.dueDate
                    ? new Date(assignment.dueDate).toLocaleString()
                    : "No due date"}
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
