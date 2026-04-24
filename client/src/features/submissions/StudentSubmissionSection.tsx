import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import EmptyState from "../../components/EmptyState";
import { getCourses, getCourseAssignments } from "../../api/courses";
import {
  createSubmission,
  getStudentSubmissions,
} from "../../api/submissions";
import { getTatSubmission } from "../../api/tat";
import type {
  Assignment,
  Submission,
  TatSubmissionResponse,
} from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { formatTatStateLabel, formatTatValue } from "../../utils/formatting";
import { isNonEmpty } from "../../utils/validation";
import { useAuth } from "../../auth/useAuth";
import { useDataRefresh } from "../../data/useDataRefresh";

export default function StudentSubmissionSection() {
  const { userId } = useAuth();
  const { versions, refresh } = useDataRefresh();

  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);

  const [submitAssignmentId, setSubmitAssignmentId] = useState("");
  const [content, setContent] = useState("");

  const [studentSubmissions, setStudentSubmissions] = useState<Submission[]>([]);
  const [tatSubmissionId, setTatSubmissionId] = useState("");
  const [tatData, setTatData] = useState<TatSubmissionResponse | null>(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const submitStudentId = userId;

  const isSubmissionFormValid =
    isNonEmpty(submitStudentId) &&
    isNonEmpty(submitAssignmentId) &&
    isNonEmpty(content);

  async function loadTatProjection(submissionId: string) {
    setError("");
    setTatData(null);
    setTatSubmissionId(submissionId);

    try {
      const projection = await getTatSubmission(submissionId);
      setTatData(projection);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  useEffect(() => {
    getCourses()
      .then(async (courseData) => {
        const assignmentsByCourse = await Promise.all(
          courseData.map((course) => getCourseAssignments(course.id))
        );

        setAllAssignments(assignmentsByCourse.flat());
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [versions.courses, versions.assignments]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    getStudentSubmissions(userId)
      .then((data) => {
        setStudentSubmissions(data);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [userId, versions.submissions]);

  async function handleCreateSubmission(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isSubmissionFormValid) {
      return;
    }

    try {
      await createSubmission({
        assignmentId: submitAssignmentId.trim(),
        studentId: submitStudentId.trim(),
        content: content.trim(),
      });

      setContent("");
      setSuccessMessage("Submission created successfully.");
      refresh("submissions");
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  function getAssignmentTitle(assignmentId: string) {
    return (
      allAssignments.find((assignment) => assignment.id === assignmentId)?.title ||
      assignmentId
    );
  }

  const tatProjection = tatData?.debug?.projections?.lmsSubmissionGraph;
  const tatAssignmentTitle = tatSubmissionId
    ? getAssignmentTitle(
        studentSubmissions.find((submission) => submission.id === tatSubmissionId)
          ?.assignmentId ?? ""
      )
    : "";

  return (
    <SectionCard title="Submissions">
      <div className="split-panel">
        <div>
          <h3>Create Submission</h3>

          <form onSubmit={handleCreateSubmission} className="form-grid">
            <select value={submitStudentId} disabled>
              <option value={submitStudentId}>Current student</option>
            </select>

            <select
              value={submitAssignmentId}
              onChange={(e) => setSubmitAssignmentId(e.target.value)}
            >
              <option value="">Select assignment</option>
              {allAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Submission content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />

            <button type="submit" disabled={!isSubmissionFormValid}>
              Submit Assignment
            </button>
          </form>
        </div>

        <div>
          <h3>My Submissions</h3>

          {!submitStudentId ? (
            <EmptyState message="No student selected." />
          ) : studentSubmissions.length === 0 ? (
            <EmptyState message="No submissions found." />
          ) : (
            <ul className="data-list">
              {studentSubmissions.map((submission) => {
                const isLoadedTatRow = tatSubmissionId === submission.id;

                return (
                  <li
                    key={submission.id}
                    className={isLoadedTatRow ? "tat-active-row" : ""}
                  >
                    <strong>{getAssignmentTitle(submission.assignmentId)}</strong>
                    <br />
                    <span>Status: {submission.status}</span>
                    <br />
                    <span>Score: {submission.score ?? "Not graded"}</span>

                    <div className="inline-actions">
                      <button
                        type="button"
                        onClick={() => loadTatProjection(submission.id)}
                      >
                        Load TAT View
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <div style={{ marginTop: 24 }}>
        <h3>TAT Submission Projection</h3>

        {!tatProjection ? (
          <EmptyState message="Load a submission projection to see semantic state." />
        ) : (
          <div className="section-card" style={{ marginTop: 16 }}>
            <h4>{tatAssignmentTitle || tatProjection.node.label}</h4>
            <p className="meta-text">
              <strong>Submission ID:</strong> {tatSubmissionId}
            </p>
            <p className="meta-text">
              <strong>Type:</strong> {formatTatStateLabel(tatProjection.node.meta.type)}
            </p>
            <p className="meta-text">
              <strong>Review State:</strong> {formatTatStateLabel(tatProjection.node.state.reviewState)}
            </p>
            <p className="meta-text">
              <strong>Grading State:</strong> {formatTatStateLabel(tatProjection.node.state.gradingState)}
            </p>
            <p className="meta-text">
              <strong>Feedback State:</strong> {formatTatStateLabel(tatProjection.node.state.feedbackState)}
            </p>
            <p className="meta-text">
              <strong>Score:</strong> {formatTatValue(tatProjection.node.state.score)}
            </p>
            <p className="meta-text">
              <strong>Mastery:</strong>{" "}
              {tatProjection.node.state.masteryLabel ? (
                <span
                  className={`mastery-badge mastery-${tatProjection.node.state.masteryLabel}`}
                >
                  {formatTatStateLabel(tatProjection.node.state.masteryLabel)}
                </span>
              ) : (
                "No mastery label"
              )}
            </p>
            <p className="meta-text">
              <strong>Mastery Band:</strong> {formatTatStateLabel(tatProjection.node.state.masteryBand)}
            </p>
            <p className="meta-text">
              <strong>Passing:</strong>{" "}
              {tatProjection.node.state.isPassing === null ||
              tatProjection.node.state.isPassing === undefined
                ? "Unknown"
                : tatProjection.node.state.isPassing
                ? "Yes"
                : "No"}
            </p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
