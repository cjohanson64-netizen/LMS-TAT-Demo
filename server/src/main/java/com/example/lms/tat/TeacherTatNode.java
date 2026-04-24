package com.example.lms.tat;

import java.util.UUID;

public record TeacherTatNode(
        UUID id,
        String label,
        String type
) {
}
