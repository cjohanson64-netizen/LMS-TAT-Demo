package com.example.lms.service;

import com.example.lms.exception.DuplicateEnrollmentException;
import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.Enrollment;
import com.example.lms.repository.CourseRepository;
import com.example.lms.repository.EnrollmentRepository;
import com.example.lms.repository.StudentRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final StudentRepository studentRepository;
    private final CourseRepository courseRepository;

    public EnrollmentService(
            EnrollmentRepository enrollmentRepository,
            StudentRepository studentRepository,
            CourseRepository courseRepository
    ) {
        this.enrollmentRepository = enrollmentRepository;
        this.studentRepository = studentRepository;
        this.courseRepository = courseRepository;
    }

    public Enrollment enrollStudent(UUID studentId, UUID courseId) {
        if (studentId == null) {
            throw new IllegalArgumentException("Student is required");
        }
        if (courseId == null) {
            throw new IllegalArgumentException("Course is required");
        }
        if (!studentRepository.existsById(studentId)) {
            throw new ResourceNotFoundException("Student not found");
        }

        if (!courseRepository.existsById(courseId)) {
            throw new ResourceNotFoundException("Course not found");
        }

        if (enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)) {
            throw new DuplicateEnrollmentException("Student is already enrolled in this course");
        }

        Enrollment enrollment = new Enrollment(
                UUID.randomUUID(),
                studentId,
                courseId,
                LocalDateTime.now()
        );

        return enrollmentRepository.save(enrollment);
    }
}
