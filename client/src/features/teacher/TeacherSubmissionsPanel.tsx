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
};

export default function TeacherSubmissionsPanel({ course }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [tatData, setTatData] = useState<TatSubmissionResponse | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadData() {
    const [assignmentData, roster] = await Promise.all([
      getCourseAssignments(course.id),
      getCourseStudents(course.id),
    ]);

    const submissionsByAssignment = await Promise.all(
      assignmentData.map((assignment) => getAssignmentSubmissions(assignment.id))
    );

    setAssignments(assignmentData);
    setStudents(roster);
    setSubmissions(submissionsByAssignment.flat());
  }

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const [assignmentData, roster] = await Promise.all([
          getCourseAssignments(course.id),
          getCourseStudents(course.id),
        ]);

        const submissionsByAssignment = await Promise.all(
          assignmentData.map((assignment) => getAssignmentSubmissions(assignment.id))
        );

        if (isCancelled) {
          return;
        }

        setAssignments(assignmentData);
        setStudents(roster);
        setSubmissions(submissionsByAssignment.flat());
      } catch (error: unknown) {
        if (!isCancelled) {
          setError(getErrorMessage(error));
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [course.id]);

  const assignmentMap = useMemo(() => {
    return new Map(assignments.map((assignment) => [assignment.id, assignment]));
  }, [assignments]);

  const ungradedSubmissions = useMemo(() => {
    return submissions
      .filter((submission) => submission.status === "SUBMITTED")
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  }, [submissions]);

  const selectedSubmission =
    ungradedSubmissions.find((submission) => submission.id === selectedSubmissionId) ??
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

        if (!isCancelled) {
          setTatData(projection);
        }
      } catch (error: unknown) {
        if (!isCancelled) {
          setError(getErrorMessage(error));
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [selectedSubmission]);

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
      await loadData();

      if (selectedSubmissionId === submissionId) {
        setSelectedSubmissionId("");
        setTatData(null);
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  function getStudentName(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    return student ? getStudentFullName(student) : studentId;
  }

  function getAssignmentTitle(assignmentId: string) {
    return assignmentMap.get(assignmentId)?.title || assignmentId;
  }

  return (
    <div>
      <h4>Submissions Needing Grading</h4>
      <p className="meta-text">
        Course-wide grading queue for <strong>{course.title}</strong>
      </p>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <div className="split-panel" style={{ marginTop: 20 }}>
        <div>
          {ungradedSubmissions.length === 0 ? (
            <EmptyState message="No submissions currently need grading." />
          ) : (
            <ul className="data-list">
              {ungradedSubmissions.map((submission) => {
                const rawScore = gradeInputs[submission.id] ?? "";
                const isValid = isNonNegativeNumberString(rawScore);
                const isSelected = selectedSubmissionId === submission.id;

                return (
                  <li
                    key={submission.id}
                    className={isSelected ? "grade-row-selected" : ""}
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
                    <span>Assignment: {getAssignmentTitle(submission.assignmentId)}</span>
                    <br />
                    <span>Submitted: {new Date(submission.submittedAt).toLocaleString()}</span>
                    <br />
                    <span>Content: {submission.content}</span>

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
            assignmentTitle={
              selectedSubmission
                ? getAssignmentTitle(selectedSubmission.assignmentId)
                : undefined
            }
            tatData={tatData}
          />
        </div>
      </div>
    </div>
  );
}
