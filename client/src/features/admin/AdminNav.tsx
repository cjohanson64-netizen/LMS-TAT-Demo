import type { AdminSection } from "./AdminDashboard";

type Props = {
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
};

export default function AdminNav({
  activeSection,
  onSelectSection,
}: Props) {
  return (
    <aside className="admin-dashboard-sidebar">
      <h3>Admin</h3>

      <ul className="data-list selectable-list">
        <li>
          <button
            type="button"
            className={activeSection === "students" ? "is-selected" : ""}
            onClick={() => onSelectSection("students")}
          >
            Students
          </button>
        </li>
        <li>
          <button
            type="button"
            className={activeSection === "teachers" ? "is-selected" : ""}
            onClick={() => onSelectSection("teachers")}
          >
            Teachers
          </button>
        </li>
        <li>
          <button
            type="button"
            className={activeSection === "courses" ? "is-selected" : ""}
            onClick={() => onSelectSection("courses")}
          >
            Courses
          </button>
        </li>
        <li>
          <button
            type="button"
            className={activeSection === "enrollments" ? "is-selected" : ""}
            onClick={() => onSelectSection("enrollments")}
          >
            Enrollments
          </button>
        </li>
      </ul>
    </aside>
  );
}