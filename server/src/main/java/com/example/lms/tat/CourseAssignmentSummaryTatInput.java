package com.example.lms.tat;

import java.util.List;

public record CourseAssignmentSummaryTatInput(
        ViewerContext viewer,
        CourseTatNode course,
        List<AssignmentSummaryTatNode> assignments
) {
}