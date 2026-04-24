package com.example.lms.tat;

import java.util.UUID;

public record AssignmentSummaryTatNode(
        UUID id,
        String label,
        int submissionCount,
        int gradedCount,
        int ungradedCount,
        String statusCode,
        String statusLabel,
        String statusTone,
        String nextActionCode,
        String nextActionLabel
) {
}
