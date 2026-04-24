import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import EmptyState from "../../components/EmptyState";
import { getCourses, getCourseAssignments } from "../../api/courses";
import { createAssignment, getAssignmentSubmissions } from "../../api/assignments";
import { getCourseAssignmentSummary } from "../../api/tat";
import type { Course, Assignment, Submission } from "../../types";
import type { CourseAssignmentSummaryProjection } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { isNonEmpty, isNonNegativeNumberString } from "../../utils/validation";
import { useDataRefresh } from "../../data/useDataRefresh";

export default function TeacherAssignmentSection() {
  const { versions, refresh } = useDataRefresh();

  const [courses, setCourses] = useState<Course[]>([]);
  const [assignmentsByCourse, setAssignmentsByCourse] = useState<
    Record<string, Assignment[]>
  >({});

  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pointsPossible, setPointsPossible] = useState("100");

  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const [summary, setSummary] =
    useState<CourseAssignmentSummaryProjection | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [submissionsModalAssignment, setSubmissionsModalAssignment] = useState<
    CourseAssignmentSummaryProjection["assignments"][number] | null
  >(null);
  const [modalSubmissions, setModalSubmissions] = useState<Submission[]>([]);
  const [isLoadingModalSubmissions, setIsLoadingModalSubmissions] =
    useState(false);
  const [modalSubmissionsError, setModalSubmissionsError] = useState("");

  const isFormValid =
    isNonEmpty(courseId) &&
    isNonEmpty(title) &&
    isNonNegativeNumberString(pointsPossible);

  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    [courses],
  );

  // Load courses
  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch((err: unknown) => setError(getErrorMessage(err)));
  }, [versions.courses]);

  // Load assignments per course (existing system)
  useEffect(() => {
    if (courses.length === 0) return;

    Promise.all(
      courses.map(async (course) => [
        course.id,
        await getCourseAssignments(course.id),
      ]),
    )
      .then((entries) => {
        setAssignmentsByCourse(Object.fromEntries(entries));
      })
      .catch((err: unknown) => setError(getErrorMessage(err)));
  }, [courses, versions.assignments]);

  // 🔥 Load TAT summary (NEW)
  useEffect(() => {
    if (!courseId) return;

    getCourseAssignmentSummary(courseId)
      .then(setSummary)
      .catch((err: unknown) => {
        setSummaryError(
          err instanceof Error
            ? err.message
            : "Could not load assignment summary",
        );
      })
      .finally(() => setIsLoadingSummary(false));
  }, [courseId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isFormValid) return;

    try {
      await createAssignment({
        courseId: courseId.trim(),
        title: title.trim(),
        description,
        dueDate: dueDate || null,
        pointsPossible: Number(pointsPossible.trim()),
      });

      setTitle("");
      setDescription("");
      setDueDate("");
      setPointsPossible("100");
      setSuccessMessage("Assignment created successfully.");

      refresh("assignments");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  }

  function handleAssignmentAction(
    assignment: CourseAssignmentSummaryProjection["assignments"][number],
  ) {
    switch (assignment.nextAction.code) {
      case "grade_submissions":
        // TODO: later open grading panel/modal
        setSuccessMessage(`Open grading flow for ${assignment.label}`);
        break;

      case "view_submissions":
        setError("");
        setSuccessMessage("");
        setModalSubmissions([]);
        setModalSubmissionsError("");
        setSubmissionsModalAssignment(assignment);
        setIsLoadingModalSubmissions(true);
        getAssignmentSubmissions(assignment.id)
          .then(setModalSubmissions)
          .catch((err: unknown) => {
            setModalSubmissionsError(getErrorMessage(err));
          })
          .finally(() => setIsLoadingModalSubmissions(false));
        break;

      case "none":
      default:
        return;
    }
  }

  return (
  <SectionCard title="Assignments">
    {/* FORM */}
    <form onSubmit={handleSubmit} className="form-grid">
      <select
        value={courseId}
        onChange={(e) => {
          const nextCourseId = e.target.value;
          setError("");
          setSummary(null);
          setSummaryError(null);
          setIsLoadingSummary(Boolean(nextCourseId));
          setCourseId(nextCourseId);
        }}
      >
        <option value="">Select course</option>
        {sortedCourses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.title} ({course.courseCode})
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Assignment title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        placeholder="Assignment description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
      />

      <input
        type="datetime-local"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />

      <input
        type="number"
        min="0"
        placeholder="Points possible"
        value={pointsPossible}
        onChange={(e) => setPointsPossible(e.target.value)}
      />

      <button type="submit" disabled={!isFormValid}>
        Create Assignment
      </button>
    </form>

    <ErrorMessage message={error} />
    <SuccessMessage message={successMessage} />

    {/* DISPLAY */}
    <div style={{ marginTop: 16 }}>
      <h3>
        {courseId
          ? "Assignments for Selected Course"
          : "All Assignments"}
      </h3>

      {!courseId ? (
        sortedCourses.length === 0 ? (
          <EmptyState message="No assignments available." />
        ) : (
          <div className="data-list">
            {sortedCourses.map((course) => {
              const list = assignmentsByCourse[course.id] ?? [];
              if (list.length === 0) return null;

              return (
                <div key={course.id} style={{ marginBottom: 16 }}>
                  <h4>
                    {course.title} ({course.courseCode})
                  </h4>
                  <ul className="data-list">
                    {list.map((assignment) => (
                      <li key={assignment.id}>
                        <strong>{assignment.title}</strong> —{" "}
                        {assignment.pointsPossible} points
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )
      ) : isLoadingSummary ? (
        <p>Loading assignment summary...</p>
      ) : summaryError ? (
        <ErrorMessage message={summaryError} />
      ) : summary && summary.assignments.length === 0 ? (
        <EmptyState message="No assignments yet." />
      ) : summary ? (
        <ul className="data-list">
          {summary.assignments.map((assignment) => {
            const toneColor: Record<
              "neutral" | "warning" | "success",
              string
            > = {
              neutral: "#888",
              warning: "#e6a700",
              success: "#2e7d32",
            };

            return (
              <li key={assignment.id}>
                {/* 👇 ROW CONTAINER (NOT a button) */}
                <div
                  style={{
                    padding: 12,
                    border: "1px solid #eee",
                    borderRadius: 6,
                    marginBottom: 8,
                  }}
                >
                  <strong>{assignment.label}</strong> —{" "}
                  {assignment.submissionCount} submissions
                  <br />

                  <span>
                    Status:{" "}
                    <strong
                      style={{
                        color: toneColor[assignment.status.tone],
                      }}
                    >
                      {assignment.status.label}
                    </strong>
                  </span>
                  <br />

                  <span>
                    Graded: {assignment.gradedCount} | Ungraded:{" "}
                    {assignment.ungradedCount}
                  </span>
                  <br />

                  {/* 👇 ACTION BUTTON (safe, no nesting) */}
                  <button
                    type="button"
                    disabled={assignment.nextAction.code === "none"}
                    style={{ marginTop: 8 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAssignmentAction(assignment);
                    }}
                  >
                    {assignment.nextAction.label}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
    {submissionsModalAssignment ? (
      <div
        className="modal-backdrop"
        role="presentation"
        onClick={() => setSubmissionsModalAssignment(null)}
      >
        <div
          className="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-submissions-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="assignment-submissions-title">
            {submissionsModalAssignment.label}
          </h2>
          <p className="modal-copy">
            {submissionsModalAssignment.submissionCount} submissions
          </p>

          {isLoadingModalSubmissions ? (
            <p>Loading submissions...</p>
          ) : modalSubmissionsError ? (
            <ErrorMessage message={modalSubmissionsError} />
          ) : modalSubmissions.length === 0 ? (
            <EmptyState message="No submissions yet for this assignment." />
          ) : (
            <ul
              className="data-list"
              style={{ maxHeight: 320, overflowY: "auto" }}
            >
              {modalSubmissions.map((submission) => (
                <li key={submission.id}>
                  <strong>{submission.studentId}</strong> — {submission.status}
                  <br />
                  <span>
                    Submitted:{" "}
                    {new Date(submission.submittedAt).toLocaleString()}
                  </span>
                  <br />
                  <span>
                    Score: {submission.score ?? "Not graded"}
                  </span>
                  {submission.content ? (
                    <>
                      <br />
                      <span>{submission.content}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={() => setSubmissionsModalAssignment(null)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    ) : null}
  </SectionCard>
);
}
