import { useEffect, useState } from "react";
import ErrorMessage from "../../components/ErrorMessage";
import EmptyState from "../../components/EmptyState";
import { getCourses } from "../../api/courses";
import type { Course } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import TeacherCourseNav from "./TeacherCourseNav";
import TeacherWorkspace from "./TeacherWorkspace";

export type TeacherWorkspaceTab = "enrollment" | "assignments" | "submissions";

export default function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [activeTab, setActiveTab] = useState<TeacherWorkspaceTab>("enrollment");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getCourses()
      .then((data) => {
        setCourses(data);

        if (data.length > 0) {
          setSelectedCourseId(data[0].id);
        }
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, []);

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? null;

  return (
    <div className="teacher-dashboard-shell">
      <TeacherCourseNav
        courses={courses}
        selectedCourseId={selectedCourseId}
        onSelectCourse={(courseId) => {
          setError("");

          if (courseId === selectedCourseId) {
            return;
          }

          setSelectedCourseId(courseId);
          setSelectedAssignmentId("");
          setActiveTab("enrollment");
        }}
      />

      <div className="teacher-dashboard-content">
        <ErrorMessage message={error} />

        {!selectedCourse ? (
          <div className="section-card">
            <EmptyState message="No teacher courses available." />
          </div>
        ) : (
          <TeacherWorkspace
            course={selectedCourse}
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
            }}
            selectedAssignmentId={selectedAssignmentId}
            onSelectAssignment={(assignmentId) => {
              setSelectedAssignmentId(assignmentId);
              setActiveTab("assignments");
            }}
            onBackToAssignments={() => {
              setSelectedAssignmentId("");
              setActiveTab("assignments");
            }}
          />
        )}
      </div>
    </div>
  );
}