import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import { createAssignment, deleteAssignment } from "../../api/assignments";
import { getCourseAssignments } from "../../api/courses";
import { getAssignmentStatus } from "../../api/tat";
import type { AssignmentStatusProjection } from "../../types";
import type { Assignment, Course } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { isNonEmpty, isNonNegativeNumberString } from "../../utils/validation";

type Props = {
  course: Course;
  selectedAssignmentId: string | null;
  onSelectAssignment: (assignmentId: string | null) => void;
};

export default function TeacherAssignmentsPanel({
  course,
  selectedAssignmentId,
  onSelectAssignment,
}: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentStatuses, setAssignmentStatuses] = useState<
    Record<string, AssignmentStatusProjection>
  >({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pointsPossible, setPointsPossible] = useState("100");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isFormValid =
    isNonEmpty(title) && isNonNegativeNumberString(pointsPossible);

  async function loadAssignments(courseId: string) {
    const data = await getCourseAssignments(courseId);
    setAssignments(data);

    const statusEntries = await Promise.all(
      data.map(async (assignment) => {
        try {
          const projection = await getAssignmentStatus(assignment.id);
          return [assignment.id, projection] as const;
        } catch {
          return [
            assignment.id,
            {
              node: {
                id: assignment.id,
                label: assignment.title,
                type: "assignment" as const,
              },
              viewer: {
                role: "TEACHER" as const,
                viewerId: "",
              },
              status: {
                code: "unknown" as const,
                label: "Unknown",
                tone: "neutral" as const,
              },
              nextAction: {
                code: "none" as const,
                label: "No Action Available",
              },
              meta: {},
            },
          ] as const;
        }
      }),
    );

    setAssignmentStatuses(Object.fromEntries(statusEntries));
  }

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const data = await getCourseAssignments(course.id);

        if (isCancelled) {
          return;
        }

        setAssignments(data);

        const statusEntries = await Promise.all(
          data.map(async (assignment) => {
            try {
              const projection = await getAssignmentStatus(assignment.id);
              return [assignment.id, projection] as const;
            } catch {
              return [
                assignment.id,
                {
                  node: {
                    id: assignment.id,
                    label: assignment.title,
                    type: "assignment" as const,
                  },
                  viewer: {
                    role: "TEACHER" as const,
                    viewerId: "",
                  },
                  status: {
                    code: "unknown" as const,
                    label: "Unknown",
                    tone: "neutral" as const,
                  },
                  nextAction: {
                    code: "none" as const,
                    label: "No Action Available",
                  },
                  meta: {},
                },
              ] as const;
            }
          }),
        );

        if (isCancelled) {
          return;
        }

        setAssignmentStatuses(Object.fromEntries(statusEntries));
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
  }, [course.id]);

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isFormValid) {
      return;
    }

    try {
      await createAssignment({
        courseId: course.id,
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

      await loadAssignments(course.id);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  async function handleDeleteAssignment(
    e: React.MouseEvent<HTMLButtonElement>,
    assignmentId: string,
  ) {
    e.stopPropagation();
    setError("");
    setSuccessMessage("");

    try {
      await deleteAssignment(assignmentId);
      setSuccessMessage("Assignment deleted successfully.");
      await loadAssignments(course.id);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  function getStatusClass(tone: AssignmentStatusProjection["status"]["tone"]) {
    switch (tone) {
      case "danger":
        return "status-badge status-danger";
      case "info":
        return "status-badge status-info";
      case "success":
        return "status-badge status-success";
      case "warning":
        return "status-badge status-warning";
      default:
        return "status-badge status-neutral";
    }
  }

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => a.title.localeCompare(b.title));
  }, [assignments]);

  const selectedAssignment = sortedAssignments.find(
    (assignment) => assignment.id === selectedAssignmentId,
  );

  const selectedProjection = selectedAssignment
    ? assignmentStatuses[selectedAssignment.id]
    : null;

  function handleNextAction(
    e: React.MouseEvent,
    assignmentId: string,
    code: string,
  ) {
    e.stopPropagation();

    switch (code) {
      case "grade_submissions":
      case "view_submissions":
        onSelectAssignment(assignmentId);
        return;

      case "none":
      default:
        return;
    }
  }

  return (
    <div>
      <h4>Assignments</h4>
      <p className="meta-text">
        Manage assignments for <strong>{course.title}</strong>
      </p>

      <form
        onSubmit={handleCreateAssignment}
        className="form-grid"
        style={{ marginTop: 16 }}
      >
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

      <div style={{ marginTop: 20 }}>
        <h4>Current Assignments</h4>

        {sortedAssignments.length === 0 ? (
          <EmptyState message="No assignments yet for this course." />
        ) : (
          <>
            <ul className="data-list selectable-list" style={{ marginTop: 16 }}>
              {sortedAssignments.map((assignment) => {
                const projection = assignmentStatuses[assignment.id];
                const status = projection?.status;
                const nextAction = projection?.nextAction;
                const meta = projection?.meta;

                return (
                  <li key={assignment.id}>
                    <div
                      className="assignment-list-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectAssignment(assignment.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectAssignment(assignment.id);
                        }
                      }}
                    >
                      <div className="assignment-list-main">
                        <strong>{assignment.title}</strong>
                        <br />
                        <span>
                          {assignment.description || "No description"}
                        </span>
                        <br />
                        <small>
                          Due:{" "}
                          {assignment.dueDate
                            ? new Date(assignment.dueDate).toLocaleString()
                            : "No due date"}
                        </small>
                        <br />
                        <small>{assignment.pointsPossible} points</small>

                        <div style={{ marginTop: 8 }}>
                          <span
                            className={getStatusClass(
                              status?.tone ?? "neutral",
                            )}
                          >
                            {status?.label ?? "Unknown"}
                          </span>
                        </div>

                        <div style={{ marginTop: 6 }}>
                          <button
                            type="button"
                            disabled={!nextAction || nextAction.code === "none"}
                            onClick={(e) =>
                              handleNextAction(
                                e,
                                assignment.id,
                                nextAction?.code ?? "none",
                              )
                            }
                          >
                            {nextAction?.label ?? "No Action Available"}
                          </button>
                        </div>

                        {typeof meta?.ungradedCount === "number" && (
                          <div style={{ marginTop: 6 }}>
                            <small>Ungraded: {meta.ungradedCount}</small>
                          </div>
                        )}
                      </div>

                      <div className="assignment-list-status">
                        <button
                          type="button"
                          className="danger-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAssignment(e, assignment.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {selectedAssignment && (
              <div
                className="assignment-detail-panel"
                style={{ marginTop: 20 }}
              >
                <h4>{selectedAssignment.title}</h4>

                <p>{selectedAssignment.description || "No description"}</p>

                <p>
                  <strong>Due:</strong>{" "}
                  {selectedAssignment.dueDate
                    ? new Date(selectedAssignment.dueDate).toLocaleString()
                    : "No due date"}
                </p>

                <p>
                  <strong>Points:</strong> {selectedAssignment.pointsPossible}
                </p>

                {selectedProjection && (
                  <>
                    <p>
                      <strong>Status:</strong> {selectedProjection.status.label}
                    </p>

                    <p>
                      <strong>Next:</strong>{" "}
                      {selectedProjection.nextAction.label}
                    </p>

                    <p>
                      <strong>Submissions:</strong>{" "}
                      {selectedProjection.meta?.submissionCount ?? 0}
                    </p>

                    <p>
                      <strong>Ungraded:</strong>{" "}
                      {selectedProjection.meta?.ungradedCount ?? 0}
                    </p>
                  </>
                )}

                <button type="button" onClick={() => onSelectAssignment(null)}>
                  Close
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
