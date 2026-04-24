package com.example.lms.tat;

import java.util.UUID;

public record CourseTatNode(
        UUID id,
        String label,
        String type
) {
}
