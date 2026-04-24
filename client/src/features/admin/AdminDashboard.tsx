import { useState } from "react";
import AdminNav from "./AdminNav";
import AdminWorkspace from "./AdminWorkspace";

export type AdminSection =
  | "students"
  | "teachers"
  | "courses"
  | "enrollments";

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<AdminSection>("students");

  return (
    <div className="admin-dashboard-shell">
      <AdminNav
        activeSection={activeSection}
        onSelectSection={setActiveSection}
      />

      <div className="admin-dashboard-content">
        <AdminWorkspace activeSection={activeSection} />
      </div>
    </div>
  );
}