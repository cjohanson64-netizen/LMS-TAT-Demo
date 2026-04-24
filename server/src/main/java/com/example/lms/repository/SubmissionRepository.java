package com.example.lms.repository;

import com.example.lms.model.Submission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubmissionRepository extends JpaRepository<Submission, UUID> {
    List<Submission> findByStudentId(UUID studentId);
    List<Submission> findByAssignmentId(UUID assignmentId);
    Optional<Submission> findByStudentIdAndAssignmentId(UUID studentId, UUID assignmentId);
    boolean existsByStudentIdAndAssignmentId(UUID studentId, UUID assignmentId);
}