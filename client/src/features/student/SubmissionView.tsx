import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import { createSubmission, getStudentSubmissions } from "../../api/submissions";
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

type Props = {
  assignment: Assignment;
  onBack: () => void;
  onSubmissionCreated: () => Promise<void> | void;
};

export default function SubmissionView({
  assignment,
  onBack,
  onSubmissionCreated,
}: Props) {
  const { userId } = useAuth();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [tatData, setTatData] = useState<TatSubmissionResponse | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isFormValid = isNonEmpty(userId) && isNonEmpty(content);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      if (!userId) {
        return;
      }

      try {
        const submissions = await getStudentSubmissions(userId);
        const matchingSubmission =
          submissions.find((item) => item.assignmentId === assignment.id) ??
          null;

        if (isCancelled) {
          return;
        }

        setSubmission(matchingSubmission);

        if (!matchingSubmission) {
          setTatData(null);
          return;
        }

        const projection = await getTatSubmission(matchingSubmission.id);

        if (isCancelled) {
          return;
        }

        setTatData(projection);
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
  }, [assignment.id, userId]);

  async function refreshSubmission() {
    if (!userId) {
      setSubmission(null);
      setTatData(null);
      return;
    }

    try {
      const submissions = await getStudentSubmissions(userId);
      const matchingSubmission =
        submissions.find((item) => item.assignmentId === assignment.id) ?? null;

      setSubmission(matchingSubmission);

      if (!matchingSubmission) {
        setTatData(null);
        return;
      }

      const projection = await getTatSubmission(matchingSubmission.id);
      setTatData(projection);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isFormValid) {
      return;
    }

    try {
      await createSubmission({
        assignmentId: assignment.id,
        studentId: userId,
        content: content.trim(),
      });

      setContent("");
      setSuccessMessage("Submission created successfully.");
      await refreshSubmission();
      await onSubmissionCreated();
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  const tatProjection = tatData?.debug?.projections?.lmsSubmissionGraph;

  return (
    <div>
      <div className="inline-actions" style={{ marginBottom: 16 }}>
        <button type="button" onClick={onBack}>
          Back to Assignments
        </button>
      </div>

      <h3>{assignment.title}</h3>
      <p className="meta-text">{assignment.description || "No description"}</p>
      <p className="meta-text">
        Due:{" "}
        {assignment.dueDate
          ? new Date(assignment.dueDate).toLocaleString()
          : "No due date"}
      </p>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      {!submission ? (
        <div style={{ marginTop: 20 }}>
          <h4>Create Submission</h4>
          <form onSubmit={handleSubmit} className="form-grid">
            <textarea
              placeholder="Write your submission here"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
            <button type="submit" disabled={!isFormValid}>
              Submit Assignment
            </button>
          </form>
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          <h4>My Submission</h4>
          <div className="section-card">
            <p className="meta-text">
              <strong>Status:</strong> {submission.status}
            </p>
            <p className="meta-text">
              <strong>Submitted:</strong>{" "}
              {new Date(submission.submittedAt).toLocaleString()}
            </p>
            <p className="meta-text">
              <strong>Content:</strong>
            </p>
            <p>{submission.content}</p>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h4>Grade Details</h4>

        {!tatProjection ? (
          <EmptyState message="No grade details are available yet." />
        ) : (
          <div className="section-card" style={{ marginTop: 12 }}>
            <p className="meta-text">
              <strong>Review State:</strong>{" "}
              {formatTatStateLabel(tatProjection.node.state.reviewState)}
            </p>
            <p className="meta-text">
              <strong>Grading State:</strong>{" "}
              {formatTatStateLabel(tatProjection.node.state.gradingState)}
            </p>
            <p className="meta-text">
              <strong>Feedback State:</strong>{" "}
              {formatTatStateLabel(tatProjection.node.state.feedbackState)}
            </p>
            <p className="meta-text">
              <strong>Score:</strong>{" "}
              {formatTatValue(tatProjection.node.state.score)}
            </p>
            <p className="meta-text">
              <strong>Mastery:</strong>{" "}
              {tatProjection.node.state.masteryLabel ? (
                <span
                  className={`mastery-badge mastery-${tatProjection.node.state.masteryLabel}`}
                >
                  {tatProjection.node.state.masteryLabel}
                </span>
              ) : (
                "No mastery label"
              )}
            </p>
            <p className="meta-text">
              <strong>Mastery Band:</strong>{" "}
              {formatTatStateLabel(tatProjection.node.state.masteryBand)}
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
    </div>
  );
}
