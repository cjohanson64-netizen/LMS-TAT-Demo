import { useAuth } from "../../auth/useAuth";
import AdminCourseSection from "./AdminCourseSection";
import TeacherCourseSection from "./TeacherCourseSection";
import StudentCourseSection from "./StudentCourseSection";

export default function CourseSection() {
  const { role } = useAuth();

  if (role === "ADMIN") {
    return <AdminCourseSection />;
  }

  if (role === "TEACHER") {
    return <TeacherCourseSection />;
  }

  return <StudentCourseSection />;
}
