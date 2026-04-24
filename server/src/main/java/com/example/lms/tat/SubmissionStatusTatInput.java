package com.example.lms.tat;

public record SubmissionStatusTatInput(
        ViewerContext viewer,
        SubmissionTatNode submission,
        AssignmentTatNode assignment,
        StudentTatNode student,
        String statusCode,
        String statusLabel,
        String statusTone,
        String nextActionCode,
        String nextActionLabel
) {
}
