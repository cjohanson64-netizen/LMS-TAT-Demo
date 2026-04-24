import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import SectionCard from "../../components/SectionCard";
import { getCourses, getCourseAssignments } from "../../api/courses";
import { getStudentSubmissions } from "../../api/submissions";
import { getAssignmentStatus } from "../../api/tat";
import type {
  Assignment,
  AssignmentStatusProjection,
  Course,
  Submission,
} from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { useAuth } from "../../auth/useAuth";
import CourseNav from "./CourseNav";
import AssignmentList from "./AssignmentList";
import SubmissionView from "./SubmissionView";

export default function StudentDashboard() {
  const { loading, role, userId } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignmentStatuses, setAssignmentStatuses] = useState<
    Map<string, AssignmentStatusProjection>
  >(new Map());
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [error, setError] = useState("");

  async function refreshSubmissions(currentUserId: string) {
    const submissionData = await getStudentSubmissions(currentUserId);
    setSubmissions(submissionData);
  }

  useEffect(() => {
    if (loading || role !== "STUDENT" || !userId) {
      return;
    }

    Promise.all([getCourses(), getStudentSubmissions(userId)])
      .then(([courseData, submissionData]) => {
        setCourses(courseData);
        setSubmissions(submissionData);

        if (courseData.length > 0) {
          setSelectedCourseId(courseData[0].id);
        } else {
          setSelectedCourseId("");
          setAssignments([]);
          setSelectedAssignmentId("");
        }
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [loading, role, userId]);

  useEffect(() => {
    if (!selectedCourseId) {
      return;
    }

    getCourseAssignments(selectedCourseId)
      .then((data) => {
        setAssignments(data);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [selectedCourseId]);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      if (assignments.length === 0) {
        if (isCancelled) {
          return;
        }

        setAssignmentStatuses(new Map());
        return;
      }

      try {
        const entries = await Promise.all(
          assignments.map(async (assignment) => [
            assignment.id,
            await getAssignmentStatus(assignment.id),
          ] as const)
        );

        if (isCancelled) {
          return;
        }

        setAssignmentStatuses(new Map(entries));
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
  }, [assignments, submissions]);

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? null;

  const selectedAssignment =
    assignments.find((assignment) => assignment.id === selectedAssignmentId) ??
    null;

  return (
    <div className="student-dashboard-shell">
      <CourseNav
        courses={courses}
        selectedCourseId={selectedCourseId}
        onSelectCourse={(courseId) => {
          setError("");

          if (courseId === selectedCourseId) {
            return;
          }

          setSelectedCourseId(courseId);
          setSelectedAssignmentId("");
        }}
      />

      <div className="student-dashboard-content">
        <ErrorMessage message={error} />

        {!selectedCourse ? (
          <SectionCard title="Assignments">
            <EmptyState message="No enrolled courses available." />
          </SectionCard>
        ) : !selectedAssignment ? (
          <SectionCard title={selectedCourse.title}>
            <AssignmentList
              course={selectedCourse}
              assignments={assignments}
              statusesByAssignmentId={assignmentStatuses}
              selectedAssignmentId={selectedAssignmentId}
              onSelectAssignment={(assignmentId) => {
                setError("");
                setSelectedAssignmentId(assignmentId);
              }}
            />
          </SectionCard>
        ) : (
          <SectionCard title={selectedAssignment.title}>
            <SubmissionView
              key={selectedAssignment.id}
              assignment={selectedAssignment}
              onBack={() => setSelectedAssignmentId("")}
              onSubmissionCreated={async () => {
                if (!userId) {
                  return;
                }

                try {
                  await refreshSubmissions(userId);
                } catch (error: unknown) {
                  setError(getErrorMessage(error));
                }
              }}
            />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
