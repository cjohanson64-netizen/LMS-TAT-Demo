import type {
  Assignment,
  AssignmentStatusProjection,
  Course,
} from "../../types";

type Props = {
  course: Course;
  assignments: Assignment[];
  statusesByAssignmentId: Map<string, AssignmentStatusProjection>;
  selectedAssignmentId: string;
  onSelectAssignment: (assignmentId: string) => void;
};

function getAssignmentStatus(
  projection: AssignmentStatusProjection | undefined
) {
  if (!projection) {
    return {
      label: "Loading",
      className: "assignment-status assignment-status-neutral",
    };
  }

  if (projection.status.tone === "danger") {
    return {
      label: projection.status.label,
      className: "assignment-status assignment-status-missing",
    };
  }

  if (projection.status.tone === "success") {
    return {
      label: projection.status.label,
      className: "assignment-status assignment-status-graded",
    };
  }

  if (projection.status.tone === "info" || projection.status.tone === "warning") {
    return {
      label: projection.status.label,
      className: "assignment-status assignment-status-submitted",
    };
  }

  return {
    label: projection.status.label,
    className: "assignment-status assignment-status-neutral",
  };
}

export default function AssignmentList({
  course,
  assignments,
  statusesByAssignmentId,
  selectedAssignmentId,
  onSelectAssignment,
}: Props) {
  return (
    <div>
      <h3>{course.title}</h3>
      <p className="meta-text">Assignments for {course.courseCode}</p>

      {assignments.length === 0 ? (
        <p className="meta-text">No assignments available for this course.</p>
      ) : (
        <ul className="data-list selectable-list">
          {assignments.map((assignment) => {
            const status = getAssignmentStatus(
              statusesByAssignmentId.get(assignment.id)
            );

            return (
              <li key={assignment.id}>
                <button
                  type="button"
                  className={
                    selectedAssignmentId === assignment.id ? "is-selected" : ""
                  }
                  onClick={() => onSelectAssignment(assignment.id)}
                >
                  <div className="assignment-list-row">
                    <div className="assignment-list-main">
                      <strong>{assignment.title}</strong>
                      <br />
                      <span>{assignment.description || "No description"}</span>
                      <br />
                      <small>
                        Due:{" "}
                        {assignment.dueDate
                          ? new Date(assignment.dueDate).toLocaleString()
                          : "No due date"}
                      </small>
                    </div>

                    <div className="assignment-list-status">
                      <span className={status.className}>{status.label}</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
