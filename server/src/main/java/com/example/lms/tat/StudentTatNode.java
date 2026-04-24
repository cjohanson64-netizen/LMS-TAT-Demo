package com.example.lms.tat;

import java.util.UUID;

public record StudentTatNode(
        UUID id,
        String label,
        String type
) {
}
