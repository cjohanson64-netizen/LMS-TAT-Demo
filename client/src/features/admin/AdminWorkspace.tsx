import SectionCard from "../../components/SectionCard";
import type { AdminSection } from "./AdminDashboard";
import AdminStudentsPanel from "./AdminStudentsPanel";
import AdminTeachersPanel from "./AdminTeachersPanel";
import AdminCoursesPanel from "./AdminCoursesPanel";
import AdminEnrollmentsPanel from "./AdminEnrollmentsPanel";

type Props = {
  activeSection: AdminSection;
};

export default function AdminWorkspace({ activeSection }: Props) {
  return (
    <SectionCard title="Admin Dashboard">
      {activeSection === "students" && <AdminStudentsPanel />}
      {activeSection === "teachers" && <AdminTeachersPanel />}
      {activeSection === "courses" && <AdminCoursesPanel />}
      {activeSection === "enrollments" && <AdminEnrollmentsPanel />}
    </SectionCard>
  );
}