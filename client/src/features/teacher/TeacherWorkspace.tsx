import SectionCard from "../../components/SectionCard";
import type { Course } from "../../types";
import type { TeacherWorkspaceTab } from "./TeacherDashboard";
import TeacherEnrollmentPanel from "./TeacherEnrollmentPanel";
import TeacherAssignmentsPanel from "./TeacherAssignmentsPanel";
import TeacherSubmissionsPanel from "./TeacherSubmissionsPanel";
import TeacherAssignmentGradingView from "./TeacherAssignmentGradingView";

type Props = {
  course: Course;
  activeTab: TeacherWorkspaceTab;
  onTabChange: (tab: TeacherWorkspaceTab) => void;
  selectedAssignmentId: string | null;
  onSelectAssignment: (assignmentId: string | null) => void;
  onBackToAssignments: () => void;
};

export default function TeacherWorkspace({
  course,
  activeTab,
  onTabChange,
  selectedAssignmentId,
  onSelectAssignment,
  onBackToAssignments,
}: Props) {
  const showAssignmentDetail =
    activeTab === "assignments" && Boolean(selectedAssignmentId);

  return (
    <SectionCard title={course.title}>
      <div className="teacher-workspace-header">
        <div>
          <h3>{course.title}</h3>
          <p className="meta-text">{course.courseCode}</p>
        </div>

        <div className="teacher-tab-bar">
          <button
            type="button"
            className={activeTab === "enrollment" ? "is-active-tab" : ""}
            onClick={() => {
              onBackToAssignments();
              onTabChange("enrollment");
            }}
          >
            Enrollment
          </button>

          <button
            type="button"
            className={activeTab === "assignments" ? "is-active-tab" : ""}
            onClick={() => onTabChange("assignments")}
          >
            Assignments
          </button>

          <button
            type="button"
            className={activeTab === "submissions" ? "is-active-tab" : ""}
            onClick={() => {
              onBackToAssignments();
              onTabChange("submissions");
            }}
          >
            Submissions
          </button>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {activeTab === "enrollment" && (
          <TeacherEnrollmentPanel course={course} />
        )}

        {activeTab === "assignments" && !showAssignmentDetail && (
          <TeacherAssignmentsPanel
            course={course}
            selectedAssignmentId={selectedAssignmentId}
            onSelectAssignment={onSelectAssignment}
          />
        )}

        {showAssignmentDetail && selectedAssignmentId && (
          <TeacherAssignmentGradingView
            key={selectedAssignmentId}
            course={course}
            assignmentId={selectedAssignmentId}
            onBack={onBackToAssignments}
          />
        )}

        {activeTab === "submissions" && (
          <TeacherSubmissionsPanel course={course} />
        )}
      </div>
    </SectionCard>
  );
}
