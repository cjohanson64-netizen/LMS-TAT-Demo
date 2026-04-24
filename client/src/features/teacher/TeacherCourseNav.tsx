import EmptyState from "../../components/EmptyState";
import type { Course } from "../../types";

type Props = {
  courses: Course[];
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
};

export default function TeacherCourseNav({
  courses,
  selectedCourseId,
  onSelectCourse,
}: Props) {
  return (
    <aside className="teacher-dashboard-sidebar">
      <h3>Courses</h3>

      {courses.length === 0 ? (
        <EmptyState message="No courses found." />
      ) : (
        <ul className="data-list selectable-list">
          {courses.map((course) => (
            <li key={course.id}>
              <button
                type="button"
                className={selectedCourseId === course.id ? "is-selected" : ""}
                onClick={() => onSelectCourse(course.id)}
              >
                <strong>{course.title}</strong>
                <br />
                <small>{course.courseCode}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}