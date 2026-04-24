import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import { getCourseAssignments, getCourseStudents } from "../../api/courses";
import { getAssignmentSubmissions } from "../../api/assignments";
import { gradeSubmission } from "../../api/submissions";
import { getTatSubmission } from "../../api/tat";
import type {
  Assignment,
  Course,
  Student,
  Submission,
  TatSubmissionResponse,
} from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { getStudentFullName } from "../../utils/profile";
import { isNonNegativeNumberString } from "../../utils/validation";
import GradeDetailsPanel from "./GradeDetailsPanel";

type Props = {
  course: Course;
  assignmentId: string;
  onBack: () => void;
};

export default function TeacherAssignmentGradingView({
  course,
  assignmentId,
  onBack,
}: Props) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [tatData, setTatData] = useState<TatSubmissionResponse | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const [assignmentList, submissionData, roster] = await Promise.all([
          getCourseAssignments(course.id),
          getAssignmentSubmissions(assignmentId),
          getCourseStudents(course.id),
        ]);

        if (isCancelled) {
          return;
        }

        const matchingAssignment =
          assignmentList.find((item) => item.id === assignmentId) ?? null;

        setAssignment(matchingAssignment);
        setSubmissions(submissionData);
        setStudents(roster);
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
  }, [course.id, assignmentId]);

  const sortedSubmissions = useMemo(() => {
    return [...submissions].sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "SUBMITTED") return -1;
        if (b.status === "SUBMITTED") return 1;
      }

      return a.submittedAt.localeCompare(b.submittedAt);
    });
  }, [submissions]);

  const selectedSubmission =
    sortedSubmissions.find((submission) => submission.id === selectedSubmissionId) ??
    null;

  useEffect(() => {
    let isCancelled = false;

    if (!selectedSubmission) {
      return () => {
        isCancelled = true;
      };
    }

    void (async () => {
      try {
        const projection = await getTatSubmission(selectedSubmission.id);

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
  }, [selectedSubmission]);

  async function reloadAssignmentData() {
    const [assignmentList, submissionData, roster] = await Promise.all([
      getCourseAssignments(course.id),
      getAssignmentSubmissions(assignmentId),
      getCourseStudents(course.id),
    ]);

    const matchingAssignment =
      assignmentList.find((item) => item.id === assignmentId) ?? null;

    setAssignment(matchingAssignment);
    setSubmissions(submissionData);
    setStudents(roster);
  }

  async function handleGradeSubmission(submissionId: string) {
    setError("");
    setSuccessMessage("");

    const rawScore = gradeInputs[submissionId];

    if (!isNonNegativeNumberString(rawScore ?? "")) {
      return;
    }

    try {
      await gradeSubmission(submissionId, {
        score: Number(rawScore.trim()),
      });

      setSuccessMessage("Submission graded successfully.");
      await reloadAssignmentData();

      if (selectedSubmissionId === submissionId) {
        const projection = await getTatSubmission(submissionId);
        setTatData(projection);
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  function getStudentName(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    return student ? getStudentFullName(student) : studentId;
  }

  return (
    <div>
      <div className="inline-actions" style={{ marginBottom: 16 }}>
        <button type="button" onClick={onBack}>
          Back to Assignments
        </button>
      </div>

      <h4>{assignment?.title ?? "Assignment"}</h4>
      <p className="meta-text">{assignment?.description || "No description"}</p>
      <p className="meta-text">
        Due:{" "}
        {assignment?.dueDate
          ? new Date(assignment.dueDate).toLocaleString()
          : "No due date"}
      </p>
      <p className="meta-text">
        Points Possible: {assignment?.pointsPossible ?? "Unknown"}
      </p>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <div className="split-panel" style={{ marginTop: 20 }}>
        <div>
          <h4>Submissions</h4>

          {sortedSubmissions.length === 0 ? (
            <EmptyState message="No submissions yet for this assignment." />
          ) : (
            <ul className="data-list">
              {sortedSubmissions.map((submission) => {
                const rawScore = gradeInputs[submission.id] ?? "";
                const isValid = isNonNegativeNumberString(rawScore);
                const isSelected = selectedSubmissionId === submission.id;

                return (
                  <li
                    key={submission.id}
                    className={isSelected ? "grade-row-selected" : "grade-row"}
                    onClick={() => {
                      if (submission.id === selectedSubmissionId) {
                        return;
                      }

                      setError("");
                      setSelectedSubmissionId(submission.id);
                    }}
                  >
                    <strong>{getStudentName(submission.studentId)}</strong>
                    <br />
                    <span>Status: {submission.status}</span>
                    <br />
                    <span>Score: {submission.score ?? "Not graded"}</span>
                    <br />
                    <span>
                      Submitted: {new Date(submission.submittedAt).toLocaleString()}
                    </span>
                    <br /><br />
                    <span>{submission.content}</span>

                    <div className="inline-actions">
                      <input
                        type="number"
                        min="0"
                        placeholder="Score"
                        value={rawScore}
                        onChange={(e) =>
                          setGradeInputs((prev) => ({
                            ...prev,
                            [submission.id]: e.target.value,
                          }))
                        }
                        onClick={(e) => e.stopPropagation()}
                      />

                      <button
                        type="button"
                        disabled={!isValid}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGradeSubmission(submission.id);
                        }}
                      >
                        Grade
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <h4>Grade Details</h4>
          <GradeDetailsPanel
            submission={selectedSubmission}
            studentName={
              selectedSubmission
                ? getStudentName(selectedSubmission.studentId)
                : undefined
            }
            tatData={tatData}
          />
        </div>
      </div>
    </div>
  );
}
