package com.example.lms.tat;

import java.util.UUID;

public record SubmissionTatNode(
        UUID id,
        UUID studentId,
        String label,
        String type,
        String reviewState,
        String gradingState,
        String feedbackState,
        Integer score,
        Boolean isPassing,
        String masteryLabel,
        String masteryBand
) {
}
