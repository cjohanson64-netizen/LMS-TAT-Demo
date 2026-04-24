package com.example.lms.tat;

import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.Assignment;
import com.example.lms.model.Course;
import com.example.lms.model.RequestUser;
import com.example.lms.model.Submission;
import com.example.lms.model.SubmissionStatus;
import com.example.lms.repository.AssignmentRepository;
import com.example.lms.repository.CourseRepository;
import com.example.lms.repository.SubmissionRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class CourseAssignmentSummaryTatInputFactory {

    private final CourseRepository courseRepository;
    private final AssignmentRepository assignmentRepository;
    private final SubmissionRepository submissionRepository;

    public CourseAssignmentSummaryTatInputFactory(
            CourseRepository courseRepository,
            AssignmentRepository assignmentRepository,
            SubmissionRepository submissionRepository
    ) {
        this.courseRepository = courseRepository;
        this.assignmentRepository = assignmentRepository;
        this.submissionRepository = submissionRepository;
    }

    public CourseAssignmentSummaryTatInput create(RequestUser user, UUID courseId) {
        UUID requiredCourseId = Objects.requireNonNull(courseId, "courseId is required");

        Course course = courseRepository.findById(requiredCourseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));

        List<Assignment> assignments = assignmentRepository.findByCourseId(requiredCourseId);

        List<UUID> assignmentIds = assignments.stream()
                .map(Assignment::getId)
                .toList();

        List<Submission> submissions = assignmentIds.stream()
                .flatMap((assignmentId) ->
                        submissionRepository.findByAssignmentId(assignmentId).stream()
                )
                .toList();

        Map<UUID, List<Submission>> submissionsByAssignment = submissions.stream()
                .collect(Collectors.groupingBy(Submission::getAssignmentId));

        List<AssignmentSummaryTatNode> assignmentNodes = assignments.stream()
                .map((assignment) -> {
                    List<Submission> assignmentSubmissions = submissionsByAssignment
                            .getOrDefault(assignment.getId(), List.of());

                    int submissionCount = assignmentSubmissions.size();

                    int gradedCount = (int) assignmentSubmissions.stream()
                            .filter((submission) -> submission.getStatus() == SubmissionStatus.GRADED)
                            .count();

                    int ungradedCount = submissionCount - gradedCount;

                    AssignmentStatusSummary summary = deriveAssignmentStatus(
                            submissionCount,
                            ungradedCount
                    );

                    return new AssignmentSummaryTatNode(
                            assignment.getId(),
                            assignment.getTitle(),
                            submissionCount,
                            gradedCount,
                            ungradedCount,
                            summary.statusCode(),
                            summary.statusLabel(),
                            summary.statusTone(),
                            summary.nextActionCode(),
                            summary.nextActionLabel()
                    );
                })
                .toList();

        ViewerContext viewer = new ViewerContext(
                user.getRole().name(),
                user.getUserId() == null ? user.getAuthUserId().toString() : user.getUserId().toString()
        );

        CourseTatNode courseNode = new CourseTatNode(
                course.getId(),
                course.getTitle(),
                "course"
        );

        return new CourseAssignmentSummaryTatInput(
                viewer,
                courseNode,
                assignmentNodes
        );
    }

    private AssignmentStatusSummary deriveAssignmentStatus(
            int submissionCount,
            int ungradedCount
    ) {
        if (submissionCount == 0) {
            return new AssignmentStatusSummary(
                    "no_submissions",
                    "No Submissions",
                    "neutral",
                    "none",
                    "No Action Available"
            );
        }

        if (ungradedCount > 0) {
            return new AssignmentStatusSummary(
                    "needs_grading",
                    "Needs Grading",
                    "warning",
                    "grade_submissions",
                    "Grade Submissions"
            );
        }

        return new AssignmentStatusSummary(
                "graded",
                "Graded",
                "success",
                "view_submissions",
                "View Submissions"
        );
    }

    private record AssignmentStatusSummary(
            String statusCode,
            String statusLabel,
            String statusTone,
            String nextActionCode,
            String nextActionLabel
    ) {
    }
}
