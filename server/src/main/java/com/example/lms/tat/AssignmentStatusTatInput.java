package com.example.lms.tat;

import java.util.List;

public record AssignmentStatusTatInput(
        ViewerContext viewer,
        AssignmentTatNode assignment,
        CourseTatNode course,
        TeacherTatNode teacher,
        List<StudentTatNode> students,
        List<SubmissionTatNode> submissions
) {
}
