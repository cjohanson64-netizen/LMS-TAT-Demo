package com.example.lms.tat;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SubmissionStatusProjection(
        Node node,
        Viewer viewer,
        Student student,
        Assignment assignment,
        Status status,
        NextAction nextAction,
        Grading grading
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

    public record Student(
            String id,
            String label
    ) {
    }

    public record Assignment(
            String id,
            String label
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

    public record Grading(
            String reviewState,
            String gradingState,
            String feedbackState,
            Integer score,
            Boolean isPassing,
            String masteryBand,
            String masteryLabel
    ) {
    }
}
