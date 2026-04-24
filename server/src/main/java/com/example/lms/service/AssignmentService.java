package com.example.lms.service;

import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.Assignment;
import com.example.lms.model.Submission;
import com.example.lms.repository.AssignmentRepository;
import com.example.lms.repository.CourseRepository;
import com.example.lms.repository.SubmissionRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class AssignmentService {

    private final AssignmentRepository assignmentRepository;
    private final CourseRepository courseRepository;
    private final SubmissionRepository submissionRepository;

    public AssignmentService(
            AssignmentRepository assignmentRepository,
            CourseRepository courseRepository,
            SubmissionRepository submissionRepository) {
        this.assignmentRepository = assignmentRepository;
        this.courseRepository = courseRepository;
        this.submissionRepository = submissionRepository;
    }

    public Assignment createAssignment(
            UUID courseId,
            String title,
            String description,
            LocalDateTime dueDate,
            Integer pointsPossible) {
        if (courseId == null) {
            throw new IllegalArgumentException("Course is required");
        }
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Assignment title is required");
        }
        if (pointsPossible == null) {
            throw new IllegalArgumentException("Points possible is required");
        }
        if (!courseRepository.existsById(courseId)) {
            throw new ResourceNotFoundException("Course not found");
        }

        Assignment assignment = new Assignment(
                UUID.randomUUID(),
                courseId,
                title.trim(),
                description,
                dueDate,
                pointsPossible);

        return assignmentRepository.save(assignment);
    }

    public List<Submission> getSubmissionsForAssignment(UUID assignmentId) {
        if (assignmentId == null) {
            throw new IllegalArgumentException("Assignment is required");
        }
        if (!assignmentRepository.existsById(assignmentId)) {
            throw new ResourceNotFoundException("Assignment not found");
        }

        return submissionRepository.findByAssignmentId(assignmentId);
    }

    public void deleteAssignment(UUID assignmentId) {
        if (assignmentId == null) {
            throw new IllegalArgumentException("Assignment is required");
        }
        if (!assignmentRepository.existsById(assignmentId)) {
            throw new ResourceNotFoundException("Assignment not found");
        }

        assignmentRepository.deleteById(Objects.requireNonNull(assignmentId));
    }
}
