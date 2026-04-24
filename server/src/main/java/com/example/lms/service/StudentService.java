package com.example.lms.service;

import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.Course;
import com.example.lms.model.Enrollment;
import com.example.lms.model.Student;
import com.example.lms.repository.CourseRepository;
import com.example.lms.repository.EnrollmentRepository;
import com.example.lms.repository.StudentRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class StudentService {

    private final StudentRepository studentRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;

    public StudentService(
            StudentRepository studentRepository,
            CourseRepository courseRepository,
            EnrollmentRepository enrollmentRepository
    ) {
        this.studentRepository = studentRepository;
        this.courseRepository = courseRepository;
        this.enrollmentRepository = enrollmentRepository;
    }

    public Student createStudent(Student studentData) {
        Student student = new Student();
        student.setId(UUID.randomUUID());
        applyStudentProfile(student, studentData);
        return studentRepository.save(student);
    }

    public List<Student> getAllStudents() {
        return studentRepository.findAll();
    }

    public List<Student> getStudentsForTeacher(UUID teacherId) {
        if (teacherId == null) {
            throw new IllegalArgumentException("Teacher is required");
        }

        List<Course> courses = courseRepository.findByTeacherId(teacherId);
        Map<UUID, Student> uniqueStudents = new LinkedHashMap<>();

        for (Course course : courses) {
            UUID courseId = Objects.requireNonNull(course.getId(), "Course ID is required");
            List<Enrollment> enrollments = enrollmentRepository.findByCourseId(courseId);

            for (Enrollment enrollment : enrollments) {
                UUID studentId = Objects.requireNonNull(
                        enrollment.getStudentId(),
                        "Enrollment student ID is required");

                studentRepository.findById(studentId)
                        .ifPresent((student) -> uniqueStudents.put(
                                Objects.requireNonNull(student.getId(), "Student ID is required"),
                                student));
            }
        }

        List<Student> students = new ArrayList<>(uniqueStudents.values());
        students.sort(Comparator.comparing(Student::getFullName, String.CASE_INSENSITIVE_ORDER));
        return students;
    }

    public Student updateStudent(UUID studentId, Student studentData) {
        if (studentId == null) {
            throw new IllegalArgumentException("Student is required");
        }
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        applyStudentProfile(student, studentData);
        return studentRepository.save(Objects.requireNonNull(student));
    }

    public void deleteStudent(UUID studentId) {
        if (studentId == null) {
            throw new IllegalArgumentException("Student is required");
        }
        if (!studentRepository.existsById(studentId)) {
            throw new ResourceNotFoundException("Student not found");
        }

        studentRepository.deleteById(Objects.requireNonNull(studentId));
    }

    private void applyStudentProfile(Student student, Student source) {
        if (source == null) {
            throw new IllegalArgumentException("Student details are required");
        }

        student.setFirstName(requireText(source.getFirstName(), "Student first name is required"));
        student.setMiddleName(normalizeOptionalText(source.getMiddleName()));
        student.setLastName(requireText(source.getLastName(), "Student last name is required"));
        student.setGender(requireValue(source.getGender(), "Student gender is required"));
        student.setDateOfBirth(requireValue(source.getDateOfBirth(), "Student date of birth is required"));
        student.setGraduationDate(requireValue(source.getGraduationDate(), "Student graduation date is required"));
        student.setEmail(requireText(source.getEmail(), "Student email is required"));
        student.setPrimaryGuardianFirstName(requireText(
                source.getPrimaryGuardianFirstName(),
                "Primary guardian first name is required"));
        student.setPrimaryGuardianLastName(requireText(
                source.getPrimaryGuardianLastName(),
                "Primary guardian last name is required"));
        student.setSecondaryGuardianFirstName(normalizeOptionalText(source.getSecondaryGuardianFirstName()));
        student.setSecondaryGuardianLastName(normalizeOptionalText(source.getSecondaryGuardianLastName()));
        student.setPrimaryGuardianEmail(normalizeOptionalText(source.getPrimaryGuardianEmail()));
        student.setSecondaryGuardianEmail(normalizeOptionalText(source.getSecondaryGuardianEmail()));
        student.setPrimaryAddress(normalizeOptionalText(source.getPrimaryAddress()));
        student.setSecondaryAddress(normalizeOptionalText(source.getSecondaryAddress()));
        student.setPrimaryPhone(normalizeOptionalText(source.getPrimaryPhone()));
        student.setSecondaryPhone(normalizeOptionalText(source.getSecondaryPhone()));
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(message);
        }

        return value.trim();
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private <T> T requireValue(T value, String message) {
        if (value == null) {
            throw new IllegalArgumentException(message);
        }

        return value;
    }
}
