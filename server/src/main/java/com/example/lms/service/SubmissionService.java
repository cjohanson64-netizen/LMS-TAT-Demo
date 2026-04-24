package com.example.lms.service;

import com.example.lms.exception.DuplicateSubmissionException;
import com.example.lms.exception.InvalidGradeException;
import com.example.lms.exception.InvalidSubmissionException;
import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.Assignment;
import com.example.lms.model.Submission;
import com.example.lms.model.SubmissionStatus;
import com.example.lms.repository.AssignmentRepository;
import com.example.lms.repository.EnrollmentRepository;
import com.example.lms.repository.StudentRepository;
import com.example.lms.repository.SubmissionRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class SubmissionService {

    private final SubmissionRepository submissionRepository;
    private final StudentRepository studentRepository;
    private final AssignmentRepository assignmentRepository;
    private final EnrollmentRepository enrollmentRepository;

    public SubmissionService(
            SubmissionRepository submissionRepository,
            StudentRepository studentRepository,
            AssignmentRepository assignmentRepository,
            EnrollmentRepository enrollmentRepository) {
        this.submissionRepository = submissionRepository;
        this.studentRepository = studentRepository;
        this.assignmentRepository = assignmentRepository;
        this.enrollmentRepository = enrollmentRepository;
    }

    public Submission createSubmission(UUID assignmentId, UUID studentId, String content) {
        if (assignmentId == null) {
            throw new IllegalArgumentException("Assignment is required");
        }
        if (studentId == null) {
            throw new IllegalArgumentException("Student is required");
        }
        if (content == null || content.trim().isEmpty()) {
            throw new InvalidSubmissionException("Submission content is required");
        }
        if (!studentRepository.existsById(studentId)) {
            throw new ResourceNotFoundException("Student not found");
        }

        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));

        boolean isEnrolled = enrollmentRepository.existsByStudentIdAndCourseId(
                studentId,
                assignment.getCourseId());

        if (!isEnrolled) {
            throw new InvalidSubmissionException("Student is not enrolled in this course");
        }

        if (submissionRepository.existsByStudentIdAndAssignmentId(studentId, assignmentId)) {
            throw new DuplicateSubmissionException("Student has already submitted this assignment");
        }

        Submission submission = new Submission(
                UUID.randomUUID(),
                assignmentId,
                studentId,
                content.trim(),
                LocalDateTime.now(),
                SubmissionStatus.SUBMITTED,
                null);

        return submissionRepository.save(submission);
    }

    public Submission gradeSubmission(UUID submissionId, Integer score) {
        if (submissionId == null) {
            throw new IllegalArgumentException("Submission is required");
        }
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found"));
        Assignment assignment = assignmentRepository.findById(
                        Objects.requireNonNull(submission.getAssignmentId(), "Submission assignment ID is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));
        if (score == null) {
            throw new InvalidGradeException("Score is required");
        }
        if (score < 0 || score > assignment.getPointsPossible()) {
            throw new InvalidGradeException("Score must be between 0 and points possible");
        }
        submission.setScore(score);
        submission.setStatus(SubmissionStatus.GRADED);
        return submissionRepository.save(submission);
    }

    public List<Submission> getStudentSubmissions(UUID studentId) {
        if (studentId == null) {
            throw new IllegalArgumentException("Student is required");
        }
        if (!studentRepository.existsById(studentId)) {
            throw new ResourceNotFoundException("Student not found");
        }

        return submissionRepository.findByStudentId(studentId);
    }
}
