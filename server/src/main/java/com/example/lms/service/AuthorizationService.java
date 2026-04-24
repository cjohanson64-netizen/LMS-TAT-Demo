package com.example.lms.service;

import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.*;
import com.example.lms.repository.*;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.UUID;

@Service
public class AuthorizationService {

    private final CourseRepository courseRepository;
    private final AssignmentRepository assignmentRepository;
    private final SubmissionRepository submissionRepository;
    private final EnrollmentRepository enrollmentRepository;

    public AuthorizationService(
            CourseRepository courseRepository,
            AssignmentRepository assignmentRepository,
            SubmissionRepository submissionRepository,
            EnrollmentRepository enrollmentRepository
    ) {
        this.courseRepository = courseRepository;
        this.assignmentRepository = assignmentRepository;
        this.submissionRepository = submissionRepository;
        this.enrollmentRepository = enrollmentRepository;
    }

    public void requireAdmin(RequestUser user) {
        if (!user.isAdmin()) {
            throw new IllegalArgumentException("Admin access required");
        }
    }

    public void requireTeacher(RequestUser user) {
        if (user.isAdmin()) {
            return;
        }

        if (!user.isTeacher()) {
            throw new IllegalArgumentException("Teacher access required");
        }
    }

    public void requireAdminOrTeacher(RequestUser user) {
        if (user.isAdmin() || user.isTeacher()) {
            return;
        }

        throw new IllegalArgumentException("Admin or teacher access required");
    }

    public void requireStudent(RequestUser user) {
        if (!user.isStudent()) {
            throw new IllegalArgumentException("Student access required");
        }
    }

    public void requireTeacherOwnsCourse(RequestUser user, UUID courseId) {
        if (courseId == null) {
            throw new IllegalArgumentException("Course is required");
        }
        if (user.isAdmin()) {
            if (!courseRepository.existsById(courseId)) {
                throw new ResourceNotFoundException("Course not found");
            }
            return;
        }

        requireTeacher(user);

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));

        if (!Objects.requireNonNull(course.getTeacherId(), "Course teacher ID is required")
                .equals(requireLinkedUserId(user))) {
            throw new IllegalArgumentException("You do not have access to this course");
        }
    }

    public void requireStudentEnrolledInCourse(RequestUser user, UUID courseId) {
        if (courseId == null) {
            throw new IllegalArgumentException("Course is required");
        }
        requireStudent(user);

        boolean enrolled = enrollmentRepository.existsByStudentIdAndCourseId(
                requireLinkedUserId(user),
                courseId
        );

        if (!enrolled) {
            throw new IllegalArgumentException("You are not enrolled in this course");
        }
    }

    public void requireTeacherOwnsAssignment(RequestUser user, UUID assignmentId) {
        if (assignmentId == null) {
            throw new IllegalArgumentException("Assignment is required");
        }
        if (user.isAdmin()) {
            if (!assignmentRepository.existsById(assignmentId)) {
                throw new ResourceNotFoundException("Assignment not found");
            }
            return;
        }

        requireTeacher(user);

        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));

        requireTeacherOwnsCourse(
                user,
                Objects.requireNonNull(assignment.getCourseId(), "Assignment course ID is required"));
    }

    public void requireStudentCanAccessAssignment(RequestUser user, UUID assignmentId) {
        if (assignmentId == null) {
            throw new IllegalArgumentException("Assignment is required");
        }
        requireStudent(user);

        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));

        requireStudentEnrolledInCourse(
                user,
                Objects.requireNonNull(assignment.getCourseId(), "Assignment course ID is required"));
    }

    public void requireCanAccessAssignment(RequestUser user, UUID assignmentId) {
        if (assignmentId == null) {
            throw new IllegalArgumentException("Assignment is required");
        }
        if (user.isAdmin()) {
            if (!assignmentRepository.existsById(assignmentId)) {
                throw new ResourceNotFoundException("Assignment not found");
            }
            return;
        }

        if (user.isTeacher()) {
            requireTeacherOwnsAssignment(user, assignmentId);
            return;
        }

        if (user.isStudent()) {
            requireStudentCanAccessAssignment(user, assignmentId);
            return;
        }

        throw new IllegalArgumentException("Invalid role");
    }

    public void requireCanAccessCourse(RequestUser user, UUID courseId) {
        if (courseId == null) {
            throw new IllegalArgumentException("Course is required");
        }
        if (user.isAdmin()) {
            if (!courseRepository.existsById(courseId)) {
                throw new ResourceNotFoundException("Course not found");
            }
            return;
        }

        if (user.isTeacher()) {
            requireTeacherOwnsCourse(user, courseId);
            return;
        }

        if (user.isStudent()) {
            requireStudentEnrolledInCourse(user, courseId);
            return;
        }

        throw new IllegalArgumentException("Invalid role");
    }

    public void requireStudentOwnsSubmission(RequestUser user, UUID submissionId) {
        if (submissionId == null) {
            throw new IllegalArgumentException("Submission is required");
        }
        requireStudent(user);

        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found"));

        if (!Objects.requireNonNull(submission.getStudentId(), "Submission student ID is required")
                .equals(requireLinkedUserId(user))) {
            throw new IllegalArgumentException("You do not have access to this submission");
        }
    }

    public void requireAdminOrStudentSelf(RequestUser user, UUID studentId) {
        if (user.isAdmin()) {
            return;
        }

        requireStudent(user);

        if (!requireLinkedUserId(user).equals(studentId)) {
            throw new IllegalArgumentException("You do not have access to this student");
        }
    }

    public void requireTeacherCanAccessSubmission(RequestUser user, UUID submissionId) {
        if (submissionId == null) {
            throw new IllegalArgumentException("Submission is required");
        }
        if (user.isAdmin()) {
            if (!submissionRepository.existsById(submissionId)) {
                throw new ResourceNotFoundException("Submission not found");
            }
            return;
        }

        requireTeacher(user);

        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found"));

        Assignment assignment = assignmentRepository.findById(
                        Objects.requireNonNull(submission.getAssignmentId(), "Submission assignment ID is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));

        requireTeacherOwnsCourse(
                user,
                Objects.requireNonNull(assignment.getCourseId(), "Assignment course ID is required"));
    }

    public void requireCanAccessSubmission(RequestUser user, UUID submissionId) {
        if (submissionId == null) {
            throw new IllegalArgumentException("Submission is required");
        }
        if (user.isAdmin()) {
            if (!submissionRepository.existsById(submissionId)) {
                throw new ResourceNotFoundException("Submission not found");
            }
            return;
        }

        if (user.isTeacher()) {
            requireTeacherCanAccessSubmission(user, submissionId);
            return;
        }

        if (user.isStudent()) {
            requireStudentOwnsSubmission(user, submissionId);
            return;
        }

        throw new IllegalArgumentException("Invalid role");
    }

    private UUID requireLinkedUserId(RequestUser user) {
        return Objects.requireNonNull(user.getUserId(), "Linked user ID is required");
    }
}
