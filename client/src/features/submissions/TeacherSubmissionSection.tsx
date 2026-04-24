import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import EmptyState from "../../components/EmptyState";
import { getStudents } from "../../api/students";
import { getCourses, getCourseAssignments } from "../../api/courses";
import { gradeSubmission } from "../../api/submissions";
import { getAssignmentSubmissions } from "../../api/assignments";
import { getTatSubmission } from "../../api/tat";
import type {
  Assignment,
  Course,
  Student,
  Submission,
  TatSubmissionResponse,
} from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { formatTatStateLabel, formatTatValue } from "../../utils/formatting";
import { getStudentFullName } from "../../utils/profile";
import { isNonNegativeNumberString } from "../../utils/validation";
import { useDataRefresh } from "../../data/useDataRefresh";

export default function TeacherSubmissionSection() {
  const { versions, refresh } = useDataRefresh();
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<Submission[]>([]);

  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [tatSubmissionId, setTatSubmissionId] = useState("");
  const [tatData, setTatData] = useState<TatSubmissionResponse | null>(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const assignmentsForSelectedCourse = useMemo(() => {
    if (!selectedCourseId) return [];
    return allAssignments.filter(
      (assignment) => assignment.courseId === selectedCourseId
    );
  }, [allAssignments, selectedCourseId]);

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
    Promise.all([getStudents(), getCourses()])
      .then(async ([studentData, courseData]) => {
        setStudents(studentData);
        setCourses(courseData);

        const assignmentsByCourse = await Promise.all(
          courseData.map((course) => getCourseAssignments(course.id))
        );

        setAllAssignments(assignmentsByCourse.flat());
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [versions.students, versions.courses, versions.assignments]);

  useEffect(() => {
    if (!selectedAssignmentId) {
      return;
    }

    getAssignmentSubmissions(selectedAssignmentId)
      .then((data) => {
        setAssignmentSubmissions(data);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [selectedAssignmentId, versions.submissions]);

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
      refresh("submissions");

      if (tatSubmissionId === submissionId) {
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

  function getAssignmentTitle(assignmentId: string) {
    return (
      allAssignments.find((assignment) => assignment.id === assignmentId)?.title ||
      assignmentId
    );
  }

  const tatProjection = tatData?.debug?.projections?.lmsSubmissionGraph;
  const loadedMastery = tatProjection?.node.state.masteryLabel;
  const tatAssignmentTitle = tatSubmissionId
    ? getAssignmentTitle(
        assignmentSubmissions.find((submission) => submission.id === tatSubmissionId)
          ?.assignmentId ?? ""
      )
    : "";

  return (
    <SectionCard title="Submissions">
      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <div>
        <h3>Assignment Submissions and Grading</h3>

        <div className="form-grid">
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setError("");
              setSelectedCourseId(e.target.value);
              setSelectedAssignmentId("");
              setAssignmentSubmissions([]);
            }}
          >
            <option value="">Select course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title} ({course.courseCode})
              </option>
            ))}
          </select>

          <select
            value={selectedAssignmentId}
            onChange={(e) => {
              setError("");
              setAssignmentSubmissions([]);
              setSelectedAssignmentId(e.target.value);
            }}
            disabled={!selectedCourseId}
          >
            <option value="">Select assignment</option>
            {assignmentsForSelectedCourse.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.title}
              </option>
            ))}
          </select>
        </div>

        {!selectedAssignmentId ? (
          <EmptyState message="Select an assignment to view and grade submissions." />
        ) : assignmentSubmissions.length === 0 ? (
          <EmptyState message="No submissions yet for this assignment." />
        ) : (
          <ul className="data-list">
            {assignmentSubmissions.map((submission) => {
              const rawScore = gradeInputs[submission.id] ?? "";
              const isGradeValid = isNonNegativeNumberString(rawScore);
              const isLoadedTatRow = tatSubmissionId === submission.id;

              return (
                <li
                  key={submission.id}
                  className={isLoadedTatRow ? "tat-active-row" : ""}
                >
                  <strong>{getStudentName(submission.studentId)}</strong>
                  <br />
                  <span>Status: {submission.status}</span>
                  <br />
                  <span>Content: {submission.content}</span>
                  <br />
                  <span>Current Score: {submission.score ?? "Not graded"}</span>
                  <br />
                  <small>{submission.id}</small>

                  {isLoadedTatRow && tatProjection ? (
                    <>
                      <br />
                      <span>
                        Semantic Review State:{" "}
                        {formatTatStateLabel(tatProjection.node.state.reviewState)}
                      </span>
                      <br />
                      <span>
                        Semantic Grading State:{" "}
                        {formatTatStateLabel(tatProjection.node.state.gradingState)}
                      </span>

                      {loadedMastery ? (
                        <>
                          <br />
                          <span>
                            Semantic Mastery:{" "}
                            <span className={`mastery-badge mastery-${loadedMastery}`}>
                              {formatTatStateLabel(loadedMastery)}
                            </span>
                          </span>
                        </>
                      ) : null}
                    </>
                  ) : null}

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
                    />

                    <button
                      type="button"
                      onClick={() => handleGradeSubmission(submission.id)}
                      disabled={!isGradeValid}
                    >
                      Grade
                    </button>

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
