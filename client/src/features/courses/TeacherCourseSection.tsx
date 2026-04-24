import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import ErrorMessage from "../../components/ErrorMessage";
import EmptyState from "../../components/EmptyState";
import {
  createCourse,
  getCourseAssignments,
  getCourseStudents,
  getCourses,
} from "../../api/courses";
import type { Assignment, Course, Student } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { getStudentFullName } from "../../utils/profile";
import { isNonEmpty } from "../../utils/validation";
import { useAuth } from "../../auth/useAuth";
import { useDataRefresh } from "../../data/useDataRefresh";

export default function TeacherCourseSection() {
  const { userId } = useAuth();
  const { versions, refresh } = useDataRefresh();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseStudents, setCourseStudents] = useState<Student[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<Assignment[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [error, setError] = useState("");

  const isFormValid =
    isNonEmpty(title) &&
    isNonEmpty(courseCode) &&
    isNonEmpty(userId);

  useEffect(() => {
    getCourses()
      .then((courseData) => {
        setCourses(courseData);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [versions.courses]);

  useEffect(() => {
    if (!selectedCourseId) {
      return;
    }

    Promise.all([
      getCourseStudents(selectedCourseId),
      getCourseAssignments(selectedCourseId),
    ])
      .then(([students, assignments]) => {
        setCourseStudents(students);
        setCourseAssignments(assignments);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [selectedCourseId, versions.enrollments, versions.assignments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isFormValid) {
      return;
    }

    try {
      await createCourse({
        title: title.trim(),
        description,
        courseCode: courseCode.trim(),
        teacherId: userId,
      });

      setTitle("");
      setDescription("");
      setCourseCode("");
      refresh("courses");
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  return (
    <SectionCard title="Courses">
      <form onSubmit={handleSubmit} className="form-grid">
        <input
          type="text"
          placeholder="Course title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Course description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="text"
          placeholder="Course code"
          value={courseCode}
          onChange={(e) => setCourseCode(e.target.value)}
        />
        <button type="submit" disabled={!isFormValid}>
          Create Course
        </button>
      </form>

      <ErrorMessage message={error} />

      <div className="split-panel">
        <div>
          <h3>My Courses</h3>
          {courses.length === 0 ? (
            <EmptyState message="No courses available." />
          ) : (
            <ul className="data-list selectable-list">
              {courses.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    className={selectedCourseId === course.id ? "is-selected" : ""}
                    onClick={() => {
                      setError("");
                      setCourseStudents([]);
                      setCourseAssignments([]);
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
          <h3>Selected Course Details</h3>
          {!selectedCourseId ? (
            <EmptyState message="Select a course to view students and assignments." />
          ) : (
            <>
              <h4>Students</h4>
              {courseStudents.length === 0 ? (
                <EmptyState message="No enrolled students yet." />
              ) : (
                <ul className="data-list">
                  {courseStudents.map((student) => (
                    <li key={student.id}>{getStudentFullName(student)}</li>
                  ))}
                </ul>
              )}

              <h4>Assignments</h4>
              {courseAssignments.length === 0 ? (
                <EmptyState message="No assignments yet." />
              ) : (
                <ul className="data-list">
                  {courseAssignments.map((assignment) => (
                    <li key={assignment.id}>
                      {assignment.title} — {assignment.pointsPossible} points
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
