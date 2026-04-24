import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import {
  createCourse,
  deleteCourse,
  getCourses,
  updateCourse,
} from "../../api/courses";
import { getTeachers } from "../../api/teachers";
import type { Course, Teacher } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { getTeacherFullName } from "../../utils/profile";
import { isNonEmpty } from "../../utils/validation";

export default function AdminCoursesPanel() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [teacherId, setTeacherId] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCourseCode, setEditCourseCode] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isFormValid =
    isNonEmpty(title) &&
    isNonEmpty(courseCode) &&
    isNonEmpty(teacherId);

  const isEditValid =
    isNonEmpty(editTitle) &&
    isNonEmpty(editCourseCode) &&
    isNonEmpty(editTeacherId);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const [courseData, teacherData] = await Promise.all([
          getCourses(),
          getTeachers(),
        ]);

        if (isCancelled) {
          return;
        }

        setCourses(courseData);
        setTeachers(teacherData);
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

  const selectedCourse = useMemo(() => {
    return courses.find((course) => course.id === selectedCourseId) ?? null;
  }, [courses, selectedCourseId]);

  function getTeacherName(teacherId: string) {
    const teacher = teachers.find((item) => item.id === teacherId);
    return teacher ? getTeacherFullName(teacher) : teacherId;
  }

  async function refreshData() {
    try {
      const [courseData, teacherData] = await Promise.all([
        getCourses(),
        getTeachers(),
      ]);

      setCourses(courseData);
      setTeachers(teacherData);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isFormValid) {
      return;
    }

    try {
      const createdCourse = await createCourse({
        title: title.trim(),
        description,
        courseCode: courseCode.trim(),
        teacherId,
      });

      setTitle("");
      setDescription("");
      setCourseCode("");
      setTeacherId("");
      setSuccessMessage("Course created successfully.");

      await refreshData();
      setSelectedCourseId(createdCourse.id);
      setIsEditing(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  async function handleDeleteCourse() {
    if (!selectedCourse) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      await deleteCourse(selectedCourse.id);
      setSuccessMessage("Course deleted successfully.");
      setSelectedCourseId("");
      setIsEditing(false);
      await refreshData();
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  async function handleUpdateCourse() {
    if (!selectedCourse || !isEditValid) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      await updateCourse(selectedCourse.id, {
        title: editTitle.trim(),
        description: editDescription,
        courseCode: editCourseCode.trim(),
        teacherId: editTeacherId,
      });

      setSuccessMessage("Course updated successfully.");
      setIsEditing(false);
      await refreshData();
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  function beginEdit() {
    if (!selectedCourse) {
      return;
    }

    setEditTitle(selectedCourse.title);
    setEditDescription(selectedCourse.description || "");
    setEditCourseCode(selectedCourse.courseCode);
    setEditTeacherId(selectedCourse.teacherId);
    setIsEditing(true);
    setError("");
    setSuccessMessage("");
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditTitle("");
    setEditDescription("");
    setEditCourseCode("");
    setEditTeacherId("");
  }

  return (
    <div>
      <h4>Courses</h4>
      <p className="meta-text">Create, inspect, edit, and remove course records.</p>

      <form
        onSubmit={handleCreateCourse}
        className="form-grid"
        style={{ marginTop: 16 }}
      >
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

        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">Select teacher</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {getTeacherFullName(teacher)}
            </option>
          ))}
        </select>

        <button type="submit" disabled={!isFormValid}>
          Add Course
        </button>
      </form>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <div className="split-panel" style={{ marginTop: 20 }}>
        <div>
          <h4>Select Existing Course</h4>

          {courses.length === 0 ? (
            <EmptyState message="No courses found." />
          ) : (
            <div className="form-grid">
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setIsEditing(false);
                }}
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} ({course.courseCode})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <h4>Course Details</h4>

          {!selectedCourse ? (
            <EmptyState message="Select a course to view details." />
          ) : isEditing ? (
            <div className="section-card" style={{ marginTop: 12 }}>
              <div className="form-grid">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Course title"
                />
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Course description"
                />
                <input
                  type="text"
                  value={editCourseCode}
                  onChange={(e) => setEditCourseCode(e.target.value)}
                  placeholder="Course code"
                />
                <select
                  value={editTeacherId}
                  onChange={(e) => setEditTeacherId(e.target.value)}
                >
                  <option value="">Select teacher</option>
                  {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                      {getTeacherFullName(teacher)}
                  </option>
                ))}
                </select>
              </div>

              <div className="inline-actions" style={{ marginTop: 16 }}>
                <button type="button" onClick={handleUpdateCourse} disabled={!isEditValid}>
                  Save Changes
                </button>
                <button type="button" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="section-card" style={{ marginTop: 12 }}>
              <p className="meta-text">
                <strong>Title:</strong> {selectedCourse.title}
              </p>
              <p className="meta-text">
                <strong>Description:</strong> {selectedCourse.description || "No description"}
              </p>
              <p className="meta-text">
                <strong>Course Code:</strong> {selectedCourse.courseCode}
              </p>
              <p className="meta-text">
                <strong>Teacher:</strong> {getTeacherName(selectedCourse.teacherId)}
              </p>
              <p className="meta-text">
                <strong>ID:</strong> {selectedCourse.id}
              </p>

              <div className="inline-actions" style={{ marginTop: 16 }}>
                <button type="button" onClick={beginEdit}>
                  Edit Course
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={handleDeleteCourse}
                >
                  Delete Course
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
