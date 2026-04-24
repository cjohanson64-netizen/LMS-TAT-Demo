import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import ErrorMessage from "../../components/ErrorMessage";
import EmptyState from "../../components/EmptyState";
import { getCourseAssignments, getCourses } from "../../api/courses";
import type { Assignment, Course } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { useDataRefresh } from "../../data/useDataRefresh";

export default function StudentCourseSection() {
  const { versions } = useDataRefresh();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseAssignments, setCourseAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getCourses()
      .then((data) => {
        setCourses(data);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [versions.courses, versions.enrollments]);

  useEffect(() => {
    if (!selectedCourseId) {
      return;
    }

    getCourseAssignments(selectedCourseId)
      .then((data) => {
        setCourseAssignments(data);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [selectedCourseId, versions.assignments]);

  return (
    <SectionCard title="Courses">
      <ErrorMessage message={error} />

      <div className="split-panel">
        <div>
          <h3>My Courses</h3>
          {courses.length === 0 ? (
            <EmptyState message="No enrolled courses available." />
          ) : (
            <ul className="data-list selectable-list">
              {courses.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    className={selectedCourseId === course.id ? "is-selected" : ""}
                    onClick={() => {
                      setError("");
                      if (selectedCourseId !== course.id) {
                        setCourseAssignments([]);
                      }
                      setSelectedCourseId(course.id);
                    }}
                  >
                    {course.title} ({course.courseCode})
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3>Course Assignments</h3>
          {!selectedCourseId ? (
            <EmptyState message="Select a course to view assignments." />
          ) : courseAssignments.length === 0 ? (
            <EmptyState message="No assignments available." />
          ) : (
            <ul className="data-list">
              {courseAssignments.map((assignment) => (
                <li key={assignment.id}>
                  <strong>{assignment.title}</strong>
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
      </div>
    </SectionCard>
  );
}
