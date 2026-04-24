package com.example.lms.tat;

import org.springframework.stereotype.Component;

@Component
public class CourseAssignmentSummaryTatModuleBuilder {

    public String build(CourseAssignmentSummaryTatInput input) {
        StringBuilder source = new StringBuilder();

        source.append("""
course_node = <{ semanticId: "course:%s" }>

""".formatted(escape(input.course().id().toString())));

        for (AssignmentSummaryTatNode assignment : input.assignments()) {
            source.append("""
%s = <{ semanticId: "assignment:%s" }>
""".formatted(
                    assignmentNodeName(assignment),
                    escape(assignment.id().toString())
            ));
        }

        source.append("""
@seed:
  nodes: [
    course_node
""");

        for (AssignmentSummaryTatNode assignment : input.assignments()) {
            source.append("""
    , %s
""".formatted(assignmentNodeName(assignment)));
        }

        source.append("""
  ]
  edges: [
""");

        for (int i = 0; i < input.assignments().size(); i++) {
            AssignmentSummaryTatNode assignment = input.assignments().get(i);

            source.append("""
    %s := [course_node : "hasAssignment" : %s]%s
""".formatted(
                    edgeName("has_assignment_edge", i),
                    assignmentNodeName(assignment),
                    i < input.assignments().size() - 1 ? "," : ""
            ));
        }

        source.append("""
  ]
  root: course_node

@projection course_assignment_summary {
  focus: course_node

  contract: {
    course: required,
    viewer: required,
    assignmentNodes: required
  }

  fields: {
    course: {
      id: @select.node(focus),
      label: @derive.meta {
        node: focus
        key: "label"
      }
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

    assignmentNodes: @select.targets(focus, "hasAssignment")
  }
}

graph := @seed
""");

        source.append("""
  -> @graft.meta(course_node, "label", "%s")
  -> @graft.state(course_node, "viewerRole", "%s")
  -> @graft.state(course_node, "viewerId", "%s")
""".formatted(
                escape(input.course().label()),
                escape(input.viewer().role()),
                escape(input.viewer().viewerId())
        ));

        for (AssignmentSummaryTatNode assignment : input.assignments()) {
            String nodeName = assignmentNodeName(assignment);

            source.append("""
  -> @graft.meta(%s, "label", "%s")
  -> @graft.meta(%s, "type", "assignment")
  -> @graft.state(%s, "submissionCount", %d)
  -> @graft.state(%s, "gradedCount", %d)
  -> @graft.state(%s, "ungradedCount", %d)
  -> @graft.state(%s, "statusCode", "%s")
  -> @graft.state(%s, "statusLabel", "%s")
  -> @graft.state(%s, "statusTone", "%s")
  -> @graft.state(%s, "nextActionCode", "%s")
  -> @graft.state(%s, "nextActionLabel", "%s")
""".formatted(
                    nodeName, escape(assignment.label()),
                    nodeName,
                    nodeName, assignment.submissionCount(),
                    nodeName, assignment.gradedCount(),
                    nodeName, assignment.ungradedCount(),
                    nodeName, escape(assignment.statusCode()),
                    nodeName, escape(assignment.statusLabel()),
                    nodeName, escape(assignment.statusTone()),
                    nodeName, escape(assignment.nextActionCode()),
                    nodeName, escape(assignment.nextActionLabel())
            ));
        }

        source.append("""
  <> @project course_assignment_summary {
    focus: course_node
  }
""");

        return source.toString();
    }

    private String assignmentNodeName(AssignmentSummaryTatNode assignment) {
        return "assignment_" + sanitizeIdentifier(assignment.id().toString());
    }

    private String edgeName(String prefix, int index) {
        return prefix + "_" + index;
    }

    private String sanitizeIdentifier(String value) {
        return value.replace("-", "_");
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