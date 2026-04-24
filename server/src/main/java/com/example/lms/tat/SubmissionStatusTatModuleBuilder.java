package com.example.lms.tat;

import org.springframework.stereotype.Component;

@Component
public class SubmissionStatusTatModuleBuilder {

    public String build(SubmissionStatusTatInput input) {
        SubmissionTatNode submission = input.submission();
        AssignmentTatNode assignment = input.assignment();
        StudentTatNode student = input.student();
        ViewerContext viewer = input.viewer();

        return """
submission_node = <{ semanticId: "submission:%s" }>
assignment_node = <{ semanticId: "assignment:%s" }>
student_node = <{ semanticId: "student:%s" }>

@seed:
  nodes: [
    submission_node,
    assignment_node,
    student_node
  ]
  edges: [
    submitted_edge := [student_node : "submitted" : submission_node],
    for_assignment_edge := [submission_node : "forAssignment" : assignment_node]
  ]
  root: submission_node

@projection submission_status {
  focus: submission_node

  contract: {
    node: required,
    viewer: required,
    student: required,
    assignment: required,
    status: required,
    nextAction: required,
    grading: required
  }

  fields: {
    node: {
      id: @select.node(focus),
      label: @derive.meta {
        node: focus
        key: "label"
      },
      type: "submission"
    },

    viewer: {
      role: @derive.state {
        node: focus
        key: "viewerRole"
      },
      viewerId: @derive.state {
        node: focus
        key: "viewerId"
      }
    },

    studentNode: @select.one(@select.sources(focus, "submitted")),

    assignmentNode: @select.one(@select.targets(focus, "forAssignment")),

    student: {
      id: studentNode,
      label: @derive.meta {
        node: studentNode
        key: "label"
      }
    },

    assignment: {
      id: assignmentNode,
      label: @derive.meta {
        node: assignmentNode
        key: "label"
      }
    },

    reviewState: @derive.state {
      node: focus
      key: "reviewState"
    },
    gradingState: @derive.state {
      node: focus
      key: "gradingState"
    },
    feedbackState: @derive.state {
      node: focus
      key: "feedbackState"
    },

    status: {
      code: @derive.state {
        node: focus
        key: "statusCode"
      },
      label: @derive.state {
        node: focus
        key: "statusLabel"
      },
      tone: @derive.state {
        node: focus
        key: "statusTone"
      }
    },

    nextAction: {
      code: @derive.state {
        node: focus
        key: "nextActionCode"
      },
      label: @derive.state {
        node: focus
        key: "nextActionLabel"
      }
    },

    grading: {
      reviewState: reviewState,
      gradingState: gradingState,
      feedbackState: feedbackState,
      score: @derive.state {
        node: focus
        key: "score"
      },
      isPassing: @derive.state {
        node: focus
        key: "isPassing"
      },
      masteryBand: @derive.state {
        node: focus
        key: "masteryBand"
      },
      masteryLabel: @derive.state {
        node: focus
        key: "masteryLabel"
      }
    }
  }
}

graph := @seed
  -> @graft.meta(submission_node, "label", "%s")
  -> @graft.meta(assignment_node, "label", "%s")
  -> @graft.meta(student_node, "label", "%s")

  -> @graft.state(submission_node, "viewerRole", "%s")
  -> @graft.state(submission_node, "viewerId", "%s")

  -> @graft.state(submission_node, "reviewState", "%s")
  -> @graft.state(submission_node, "gradingState", "%s")
  -> @graft.state(submission_node, "feedbackState", "%s")

  -> @graft.state(submission_node, "score", %s)
  -> @graft.state(submission_node, "isPassing", %s)
  -> @graft.state(submission_node, "masteryBand", "%s")
  -> @graft.state(submission_node, "masteryLabel", "%s")

  -> @graft.state(submission_node, "statusCode", "%s")
  -> @graft.state(submission_node, "statusLabel", "%s")
  -> @graft.state(submission_node, "statusTone", "%s")

  -> @graft.state(submission_node, "nextActionCode", "%s")
  -> @graft.state(submission_node, "nextActionLabel", "%s")

  <> @project submission_status {
    focus: submission_node
  }
""".formatted(
                escape(submission.id().toString()),
                escape(assignment.id().toString()),
                escape(student.id().toString()),

                escape(submission.label()),
                escape(assignment.label()),
                escape(student.label()),

                escape(viewer.role()),
                escape(viewer.viewerId()),

                escape(defaultString(submission.reviewState(), "unreviewed")),
                escape(defaultString(submission.gradingState(), "ungraded")),
                escape(defaultString(submission.feedbackState(), "none")),

                nullableNumber(submission.score()),
                nullableBoolean(submission.isPassing()),
                escape(defaultString(submission.masteryBand(), "unscored")),
                escape(defaultString(submission.masteryLabel(), "Unscored")),

                escape(defaultString(input.statusCode(), "unknown")),
                escape(defaultString(input.statusLabel(), "Unknown")),
                escape(defaultString(input.statusTone(), "neutral")),

                escape(defaultString(input.nextActionCode(), "none")),
                escape(defaultString(input.nextActionLabel(), "No Action Available"))
        );
    }

    private String nullableNumber(Integer value) {
        return value == null ? "null" : value.toString();
    }

    private String nullableBoolean(Boolean value) {
        return value == null ? "null" : value.toString();
    }

    private String defaultString(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
}
