package com.example.lms.tat;

import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.Assignment;
import com.example.lms.model.RequestUser;
import com.example.lms.model.Student;
import com.example.lms.model.Submission;
import com.example.lms.model.SubmissionStatus;
import com.example.lms.repository.AssignmentRepository;
import com.example.lms.repository.StudentRepository;
import com.example.lms.repository.SubmissionRepository;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.UUID;

@Component
public class SubmissionStatusTatInputFactory {

    private final SubmissionRepository submissionRepository;
    private final AssignmentRepository assignmentRepository;
    private final StudentRepository studentRepository;

    public SubmissionStatusTatInputFactory(
            SubmissionRepository submissionRepository,
            AssignmentRepository assignmentRepository,
            StudentRepository studentRepository
    ) {
        this.submissionRepository = submissionRepository;
        this.assignmentRepository = assignmentRepository;
        this.studentRepository = studentRepository;
    }

    public SubmissionStatusTatInput create(RequestUser user, UUID submissionId) {
        if (submissionId == null) {
            throw new IllegalArgumentException("Submission is required");
        }

        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found"));

        Assignment assignment = assignmentRepository.findById(
                        Objects.requireNonNull(submission.getAssignmentId(), "Submission assignment ID is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));

        Student student = studentRepository.findById(
                        Objects.requireNonNull(submission.getStudentId(), "Submission student ID is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        Integer score = submission.getScore();
        ViewerContext viewer = new ViewerContext(
                user.isStudent() ? "STUDENT" : "TEACHER",
                user.getUserId() != null ? user.getUserId().toString() : user.getAuthUserId().toString()
        );

        SubmissionTatNode submissionNode = new SubmissionTatNode(
                submission.getId(),
                submission.getStudentId(),
                "Submission " + submission.getId(),
                "submission",
                score == null ? "submitted" : "reviewed",
                score == null ? "ungraded" : "graded",
                score == null ? "awaiting_feedback" : "feedback_ready",
                score,
                score == null ? null : score >= 70,
                deriveMasteryLabel(score),
                deriveMasteryBand(score)
        );

        return new SubmissionStatusTatInput(
                viewer,
                submissionNode,
                new AssignmentTatNode(assignment.getId(), assignment.getTitle(), "assignment"),
                new StudentTatNode(student.getId(), student.getFullName(), "student"),
                deriveStatusCode(submission),
                deriveStatusLabel(submission),
                deriveStatusTone(submission),
                deriveNextActionCode(user, submission),
                deriveNextActionLabel(user, submission)
        );
    }

    private String deriveStatusCode(Submission submission) {
        if (submission.getStatus() == SubmissionStatus.GRADED || submission.getScore() != null) {
            return "graded";
        }
        return "submitted";
    }

    private String deriveStatusLabel(Submission submission) {
        if (submission.getStatus() == SubmissionStatus.GRADED || submission.getScore() != null) {
            return "Graded";
        }
        return "Submitted";
    }

    private String deriveStatusTone(Submission submission) {
        if (submission.getStatus() == SubmissionStatus.GRADED || submission.getScore() != null) {
            return "success";
        }
        return "pending";
    }

    private String deriveNextActionCode(RequestUser user, Submission submission) {
        boolean graded = submission.getStatus() == SubmissionStatus.GRADED || submission.getScore() != null;
        if (graded) {
            return user.isStudent() ? "review_feedback" : "review_grade";
        }
        return user.isStudent() ? "wait_for_grade" : "grade_submission";
    }

    private String deriveNextActionLabel(RequestUser user, Submission submission) {
        boolean graded = submission.getStatus() == SubmissionStatus.GRADED || submission.getScore() != null;
        if (graded) {
            return user.isStudent() ? "Review Feedback" : "Review Grade";
        }
        return user.isStudent() ? "Wait for Grade" : "Grade Submission";
    }

    private String deriveMasteryLabel(Integer score) {
        if (score == null) {
            return "unscored";
        }
        if (score >= 90) {
            return "advanced";
        }
        if (score >= 80) {
            return "proficient";
        }
        if (score >= 70) {
            return "developing";
        }
        return "beginning";
    }

    private String deriveMasteryBand(Integer score) {
        if (score == null) {
            return "ungraded";
        }
        if (score >= 90) {
            return "exceeds";
        }
        if (score >= 80) {
            return "meets";
        }
        if (score >= 70) {
            return "approaching";
        }
        return "below_target";
    }
}
