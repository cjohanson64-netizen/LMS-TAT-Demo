package com.example.lms.tat;

import java.util.UUID;

public record AssignmentTatNode(
        UUID id,
        String label,
        String type
) {
}
