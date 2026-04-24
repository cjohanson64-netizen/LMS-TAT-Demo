import EmptyState from "../../components/EmptyState";
import type { Submission, TatSubmissionResponse } from "../../types";
import { formatTatStateLabel, formatTatValue } from "../../utils/formatting";

type Props = {
  submission: Submission | null;
  studentName?: string;
  assignmentTitle?: string;
  tatData: TatSubmissionResponse | null;
  loadingMessage?: string;
  emptyMessage?: string;
};

export default function GradeDetailsPanel({
  submission,
  studentName,
  assignmentTitle,
  tatData,
  loadingMessage = "Loading grade details...",
  emptyMessage = "Select a submission to view details.",
}: Props) {
  const tatProjection = tatData?.debug?.projections?.lmsSubmissionGraph;

  if (!submission) {
    return <EmptyState message={emptyMessage} />;
  }

  if (!tatProjection) {
    return <EmptyState message={loadingMessage} />;
  }

  return (
    <div className="section-card" style={{ marginTop: 12 }}>
      {studentName ? (
        <p className="meta-text">
          <strong>Student:</strong> {studentName}
        </p>
      ) : null}

      {assignmentTitle ? (
        <p className="meta-text">
          <strong>Assignment:</strong> {assignmentTitle}
        </p>
      ) : null}

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
        <strong>Score:</strong> {formatTatValue(tatProjection.node.state.score)}
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
          "—"
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
  );
}
