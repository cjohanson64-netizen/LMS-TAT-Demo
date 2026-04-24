package com.example.lms.tat;

import java.util.List;

public record CourseAssignmentSummaryProjection(
        Course course,
        Viewer viewer,
        List<String> assignmentNodes,
        List<AssignmentSummary> assignments
) {
    public record Course(
            String id,
            String label
    ) {
    }

    public record Viewer(
            String role,
            String viewerId
    ) {
    }

    public record AssignmentSummary(
            String id,
            String label,
            int submissionCount,
            int gradedCount,
            int ungradedCount,
            Status status,
            NextAction nextAction
    ) {
    }

    public record Status(
            String code,
            String label,
            String tone
    ) {
    }

    public record NextAction(
            String code,
            String label
    ) {
    }
}