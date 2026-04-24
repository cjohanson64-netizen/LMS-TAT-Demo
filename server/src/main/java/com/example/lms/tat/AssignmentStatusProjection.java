package com.example.lms.tat;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AssignmentStatusProjection(
        Node node,
        Viewer viewer,
        Status status,
        NextAction nextAction,
        Meta meta
) {
    public record Node(
            String id,
            String label,
            String type
    ) {
    }

    public record Viewer(
            String role,
            String viewerId
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

    public record Meta(
            Integer submissionCount,
            Integer gradedCount,
            Integer ungradedCount,
            Boolean hasSubmission,
            Boolean hasGrade
    ) {
    }
}
