package com.example.lms.tat;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
public class AssignmentStatusTatModuleBuilder {

    public String build(AssignmentStatusTatInput input) {
        String assignmentVar = nodeId("assignment", input.assignment().id());
        String courseVar = nodeId("course", input.course().id());
        String teacherVar = nodeId("teacher", input.teacher().id());

        List<String> nodeVars = new ArrayList<>();
        List<String> edgeDefs = new ArrayList<>();
        List<String> pipeline = new ArrayList<>();

        nodeVars.add(assignmentVar);
        nodeVars.add(courseVar);
        nodeVars.add(teacherVar);

        StringBuilder out = new StringBuilder();

        appendNodeDeclaration(out, assignmentVar, "semanticId", "assignment:" + input.assignment().id(), "title",
                input.assignment().label());
        appendNodeDeclaration(out, courseVar, "semanticId", "course:" + input.course().id(), "title",
                input.course().label());
        appendNodeDeclaration(out, teacherVar, "semanticId", "teacher:" + input.teacher().id(), "name",
                input.teacher().label());

        edgeDefs.add("teaches_edge := [" + teacherVar + " : " + quote("teaches") + " : " + courseVar + "]");
        edgeDefs.add(
                "has_assignment_edge := [" + courseVar + " : " + quote("hasAssignment") + " : " + assignmentVar + "]");

        appendNodeMetaPipeline(pipeline, assignmentVar, input.assignment().label(), input.assignment().type());
        appendNodeMetaPipeline(pipeline, courseVar, input.course().label(), input.course().type());
        appendNodeMetaPipeline(pipeline, teacherVar, input.teacher().label(), input.teacher().type());

        for (StudentTatNode student : input.students()) {
            String studentVar = nodeId("student", student.id());
            nodeVars.add(studentVar);
            appendNodeDeclaration(out, studentVar, "semanticId", "student:" + student.id(), "name", student.label());
            edgeDefs.add(nodeId("enrolled", student.id()) + " := [" + studentVar + " : " + quote("enrolledIn") + " : "
                    + courseVar + "]");
            appendNodeMetaPipeline(pipeline, studentVar, student.label(), student.type());
        }

        for (SubmissionTatNode submission : input.submissions()) {
            String submissionVar = nodeId("submission", submission.id());
            String studentVar = nodeId("student", submission.studentId());

            nodeVars.add(submissionVar);
            appendNodeDeclaration(out, submissionVar, "semanticId", "submission:" + submission.id(), "title",
                    submission.label());
            edgeDefs.add(nodeId("submitted", submission.id()) + " := [" + studentVar + " : " + quote("submitted")
                    + " : " + submissionVar + "]");
            edgeDefs.add(nodeId("for_assignment", submission.id()) + " := [" + submissionVar + " : "
                    + quote("forAssignment") + " : " + assignmentVar + "]");

            appendNodeMetaPipeline(pipeline, submissionVar, submission.label(), submission.type());
            appendStatePipeline(pipeline, submissionVar, "reviewState", literal(submission.reviewState()));
            appendStatePipeline(pipeline, submissionVar, "gradingState", literal(submission.gradingState()));
            appendStatePipeline(pipeline, submissionVar, "feedbackState", literal(submission.feedbackState()));
            appendStatePipeline(pipeline, submissionVar, "score", literal(submission.score()));
            appendStatePipeline(pipeline, submissionVar, "isPassing", literal(submission.isPassing()));
            appendStatePipeline(pipeline, submissionVar, "masteryLabel", literal(submission.masteryLabel()));
            appendStatePipeline(pipeline, submissionVar, "masteryBand", literal(submission.masteryBand()));
        }

        appendStatePipeline(pipeline, assignmentVar, "viewerRole", literal(input.viewer().role()));
        appendStatePipeline(pipeline, assignmentVar, "viewerId", literal(input.viewer().viewerId()));

        out.append("""
                @seed:
                  nodes: [
                """);
        for (int i = 0; i < nodeVars.size(); i += 1) {
            out.append("    ").append(nodeVars.get(i));
            out.append(i < nodeVars.size() - 1 ? ",\n" : "\n");
        }
        out.append("""
                  ]
                  edges: [
                """);
        for (int i = 0; i < edgeDefs.size(); i += 1) {
            out.append("    ").append(edgeDefs.get(i));
            out.append(i < edgeDefs.size() - 1 ? ",\n" : "\n");
        }
        out.append("""
                  ]
                  root: """).append(assignmentVar).append("\n\n");

        out.append("assignmentStatusGraph := @seed\n");
        for (String step : pipeline) {
            out.append("  -> ").append(step).append("\n");
        }
        out.append("  <> @project(format: ").append(quote("assignment_status")).append(", focus: ")
                .append(assignmentVar).append(")\n");

        return out.toString();
    }

    private void appendNodeDeclaration(
            StringBuilder out,
            String varName,
            String semanticKey,
            String semanticValue,
            String labelKey,
            String labelValue) {
        out.append(varName)
                .append(" = <{ ")
                .append(semanticKey)
                .append(": ")
                .append(quote(semanticValue))
                .append(", ")
                .append(labelKey)
                .append(": ")
                .append(quote(labelValue))
                .append(" }>\n");
    }

    private void appendNodeMetaPipeline(List<String> pipeline, String nodeVar, String label, String type) {
        pipeline.add("@graft.meta(" + nodeVar + ", " + quote("label") + ", " + quote(label) + ")");
        pipeline.add("@graft.meta(" + nodeVar + ", " + quote("type") + ", " + quote(type) + ")");
        pipeline.add("@graft.meta(" + nodeVar + ", " + quote("domain") + ", " + quote("lms") + ")");
        pipeline.add("@graft.meta(" + nodeVar + ", " + quote("kind") + ", " + quote(type) + ")");
    }

    private void appendStatePipeline(List<String> pipeline, String nodeVar, String key, String valueLiteral) {
        pipeline.add("@graft.state(" + nodeVar + ", " + quote(key) + ", " + valueLiteral + ")");
    }

    private String nodeId(String prefix, UUID id) {
        return prefix + "_" + id.toString().replace("-", "_");
    }

    private String literal(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof String text) {
            return quote(text);
        }
        if (value instanceof Boolean bool) {
            return bool ? "true" : "false";
        }
        return String.valueOf(value);
    }

    private String quote(String value) {
        return "\"" + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t") + "\"";
    }
}
