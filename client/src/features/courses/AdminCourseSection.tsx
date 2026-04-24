import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import EmptyState from "../../components/EmptyState";
import { getTeachers } from "../../api/teachers";
import {
  createCourse,
  getCourseAssignments,
  getCourseStudents,
  getCourses,
} from "../../api/courses";
import type { Assignment, Course, Student, Teacher } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { getStudentFullName, getTeacherFullName } from "../../utils/profile";
import { isNonEmpty } from "../../utils/validation";
import { useDataRefresh } from "../../data/useDataRefresh";

export default function AdminCourseSection() {
  const { versions, refresh } = useDataRefresh();
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseStudents, setCourseStudents] = useState<Student[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<Assignment[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isFormValid =
    isNonEmpty(title) && isNonEmpty(courseCode) && isNonEmpty(teacherId);

  function getTeacherName(courseTeacherId: string): string {
    return (
      teachers.find((teacher) => teacher.id === courseTeacherId)
        ? getTeacherFullName(
            teachers.find((teacher) => teacher.id === courseTeacherId) as Teacher
          )
        :
      courseTeacherId
    );
  }

  useEffect(() => {
    Promise.all([getCourses(), getTeachers()])
      .then(([courseData, teacherData]) => {
        setCourses(courseData);
        setTeachers(teacherData);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [versions.courses, versions.teachers]);

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
    setSuccessMessage("");

    if (!isFormValid) {
      return;
    }

    try {
      await createCourse({
        title: title.trim(),
        description,
        courseCode: courseCode.trim(),
        teacherId: teacherId.trim(),
      });

      setTitle("");
      setDescription("");
      setCourseCode("");
      setTeacherId("");
      setSuccessMessage("Course created successfully.");
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
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        >
          <option value="">Select teacher</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {getTeacherFullName(teacher)}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!isFormValid}>
          Create Course
        </button>
      </form>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <div className="split-panel">
        <div>
          <h3>All Courses</h3>
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
                    {course.title} ({course.courseCode}) —{" "}
                    {getTeacherName(course.teacherId)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3>Selected Course Details</h3>
          {!selectedCourseId ? (
            <EmptyState message="Select a course to inspect rosters and assignments." />
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
