package com.example.lms.tat;

import com.example.lms.service.TatService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AssignmentStatusTatRuntimeTest {

    private final AssignmentStatusTatModuleBuilder builder = new AssignmentStatusTatModuleBuilder();
    private final TatService tatService = new TatService(null, null, null, null);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void studentAssignmentWithoutSubmissionIsAwaitingSubmission() throws Exception {
        AssignmentStatusProjection projection = execute(buildStudentInput(List.of()));

        assertEquals("awaiting_submission", projection.status().code());
        assertEquals("Not Submitted", projection.status().label());
        assertEquals("danger", projection.status().tone());
        assertEquals("submit_work", projection.nextAction().code());
        assertEquals(0, projection.meta().submissionCount());
        assertEquals(0, projection.meta().gradedCount());
        assertEquals(0, projection.meta().ungradedCount());
        assertFalse(Boolean.TRUE.equals(projection.meta().hasSubmission()));
        assertFalse(Boolean.TRUE.equals(projection.meta().hasGrade()));
    }

    @Test
    void studentAssignmentWithUngradedSubmissionIsSubmitted() throws Exception {
        AssignmentStatusProjection projection = execute(buildStudentInput(List.of(
                buildSubmission(false, null)
        )));

        assertEquals("submitted", projection.status().code());
        assertEquals("Submitted", projection.status().label());
        assertEquals("info", projection.status().tone());
        assertEquals("wait_for_grade", projection.nextAction().code());
        assertEquals(1, projection.meta().submissionCount());
        assertEquals(0, projection.meta().gradedCount());
        assertEquals(1, projection.meta().ungradedCount());
        assertTrue(Boolean.TRUE.equals(projection.meta().hasSubmission()));
        assertFalse(Boolean.TRUE.equals(projection.meta().hasGrade()));
    }

    @Test
    void studentAssignmentWithGradedSubmissionIsGraded() throws Exception {
        AssignmentStatusProjection projection = execute(buildStudentInput(List.of(
                buildSubmission(true, 94)
        )));

        assertEquals("graded", projection.status().code());
        assertEquals("Graded", projection.status().label());
        assertEquals("success", projection.status().tone());
        assertEquals("review_feedback", projection.nextAction().code());
        assertEquals(1, projection.meta().submissionCount());
        assertEquals(1, projection.meta().gradedCount());
        assertEquals(0, projection.meta().ungradedCount());
        assertTrue(Boolean.TRUE.equals(projection.meta().hasSubmission()));
        assertTrue(Boolean.TRUE.equals(projection.meta().hasGrade()));
    }

    @Test
    void teacherAssignmentWithoutSubmissionsIsNoSubmissions() throws Exception {
        AssignmentStatusProjection projection = execute(buildTeacherInput(List.of()));

        assertEquals("no_submissions", projection.status().code());
        assertEquals("neutral", projection.status().tone());
        assertEquals("none", projection.nextAction().code());
        assertEquals(0, projection.meta().submissionCount());
        assertEquals(0, projection.meta().gradedCount());
        assertEquals(0, projection.meta().ungradedCount());
        assertFalse(Boolean.TRUE.equals(projection.meta().hasSubmission()));
        assertFalse(Boolean.TRUE.equals(projection.meta().hasGrade()));
    }

    @Test
    void teacherAssignmentWithMixedSubmissionStatesNeedsGrading() throws Exception {
        AssignmentStatusProjection projection = execute(buildTeacherInput(List.of(
                buildSubmission(true, 91),
                buildSubmission(false, null)
        )));

        assertEquals("needs_grading", projection.status().code());
        assertEquals("warning", projection.status().tone());
        assertEquals("grade_submissions", projection.nextAction().code());
        assertEquals(2, projection.meta().submissionCount());
        assertEquals(1, projection.meta().gradedCount());
        assertEquals(1, projection.meta().ungradedCount());
        assertTrue(Boolean.TRUE.equals(projection.meta().hasSubmission()));
        assertTrue(Boolean.TRUE.equals(projection.meta().hasGrade()));
    }

    @Test
    void teacherAssignmentWithAllGradedSubmissionsIsGraded() throws Exception {
        AssignmentStatusProjection projection = execute(buildTeacherInput(List.of(
                buildSubmission(true, 91),
                new SubmissionTatNode(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "Submission B",
                        "submission",
                        "reviewed",
                        "graded",
                        "available",
                        84,
                        true,
                        "proficient",
                        "meeting"
                )
        )));

        assertEquals("graded", projection.status().code());
        assertEquals("success", projection.status().tone());
        assertEquals("view_submissions", projection.nextAction().code());
        assertEquals(2, projection.meta().submissionCount());
        assertEquals(2, projection.meta().gradedCount());
        assertEquals(0, projection.meta().ungradedCount());
        assertTrue(Boolean.TRUE.equals(projection.meta().hasSubmission()));
        assertTrue(Boolean.TRUE.equals(projection.meta().hasGrade()));
    }

    private AssignmentStatusProjection execute(AssignmentStatusTatInput input) throws Exception {
        String source = builder.build(input);
        String raw = tatService.runTatSource(source);
        JsonNode node = objectMapper.readTree(raw).path("debug").path("projections").path("assignmentStatusGraph");
        return objectMapper.treeToValue(node, AssignmentStatusProjection.class);
    }

    private AssignmentStatusTatInput buildStudentInput(List<SubmissionTatNode> submissions) {
        UUID assignmentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID teacherId = UUID.randomUUID();
        UUID studentId = submissions.isEmpty() ? UUID.randomUUID() : submissions.getFirst().studentId();
        return new AssignmentStatusTatInput(
                new ViewerContext("STUDENT", studentId.toString()),
                new AssignmentTatNode(assignmentId, "Sight Singing 1", "assignment"),
                new CourseTatNode(courseId, "Beginning Musicianship", "course"),
                new TeacherTatNode(teacherId, "Teacher Ada", "teacher"),
                List.of(new StudentTatNode(studentId, "Student Ava", "student")),
                submissions
        );
    }

    private AssignmentStatusTatInput buildTeacherInput(List<SubmissionTatNode> submissions) {
        UUID assignmentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID teacherId = UUID.randomUUID();

        List<StudentTatNode> students = submissions.stream()
                .map((submission) -> new StudentTatNode(
                        submission.studentId(),
                        "Student " + submission.studentId().toString().substring(0, 4),
                        "student"
                ))
                .distinct()
                .toList();

        return new AssignmentStatusTatInput(
                new ViewerContext("TEACHER", teacherId.toString()),
                new AssignmentTatNode(assignmentId, "Sight Singing 1", "assignment"),
                new CourseTatNode(courseId, "Beginning Musicianship", "course"),
                new TeacherTatNode(teacherId, "Teacher Ada", "teacher"),
                students,
                submissions
        );
    }

    private SubmissionTatNode buildSubmission(boolean graded, Integer score) {
        UUID studentId = UUID.randomUUID();
        return new SubmissionTatNode(
                UUID.randomUUID(),
                studentId,
                "Submission " + studentId.toString().substring(0, 4),
                "submission",
                graded ? "reviewed" : "submitted",
                graded ? "graded" : "ungraded",
                graded ? "available" : "not_available",
                score,
                graded ? Boolean.TRUE : null,
                graded ? "advanced" : "unscored",
                graded ? "exceeding" : "unscored"
        );
    }
}
