package com.example.lms.service;

import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.Assignment;
import com.example.lms.model.Course;
import com.example.lms.model.Enrollment;
import com.example.lms.model.RequestUser;
import com.example.lms.model.Student;
import com.example.lms.repository.AssignmentRepository;
import com.example.lms.repository.CourseRepository;
import com.example.lms.repository.EnrollmentRepository;
import com.example.lms.repository.StudentRepository;
import com.example.lms.repository.TeacherRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class CourseService {
    private static final Comparator<Course> COURSE_CODE_ORDER =
            Comparator.comparing(Course::getCourseCode, String.CASE_INSENSITIVE_ORDER);

    private final CourseRepository courseRepository;
    private final TeacherRepository teacherRepository;
    private final AssignmentRepository assignmentRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final StudentRepository studentRepository;

    public CourseService(
            CourseRepository courseRepository,
            TeacherRepository teacherRepository,
            AssignmentRepository assignmentRepository,
            EnrollmentRepository enrollmentRepository,
            StudentRepository studentRepository
    ) {
        this.courseRepository = courseRepository;
        this.teacherRepository = teacherRepository;
        this.assignmentRepository = assignmentRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.studentRepository = studentRepository;
    }

    public Course createCourse(String title, String description, String courseCode, UUID teacherId) {
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Course title is required");
        }
        if (courseCode == null || courseCode.trim().isEmpty()) {
            throw new IllegalArgumentException("Course code is required");
        }
        if (teacherId == null) {
            throw new IllegalArgumentException("Teacher is required");
        }
        if (!teacherRepository.existsById(teacherId)) {
            throw new ResourceNotFoundException("Teacher not found");
        }

        Course course = new Course(
                UUID.randomUUID(),
                title.trim(),
                description,
                courseCode.trim(),
                teacherId
        );
        return courseRepository.save(course);
    }

    public Course updateCourse(
            UUID courseId,
            String title,
            String description,
            String courseCode,
            UUID teacherId
    ) {
        if (courseId == null) {
            throw new IllegalArgumentException("Course is required");
        }
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));

        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Course title is required");
        }
        if (courseCode == null || courseCode.trim().isEmpty()) {
            throw new IllegalArgumentException("Course code is required");
        }
        if (teacherId == null) {
            throw new IllegalArgumentException("Teacher is required");
        }
        if (!teacherRepository.existsById(teacherId)) {
            throw new ResourceNotFoundException("Teacher not found");
        }

        course.setTitle(title.trim());
        course.setDescription(description);
        course.setCourseCode(courseCode.trim());
        course.setTeacherId(teacherId);

        return courseRepository.save(course);
    }

    public void deleteCourse(UUID courseId) {
        if (courseId == null) {
            throw new IllegalArgumentException("Course is required");
        }
        if (!courseRepository.existsById(courseId)) {
            throw new ResourceNotFoundException("Course not found");
        }

        courseRepository.deleteById(Objects.requireNonNull(courseId));
    }

    public List<Course> getCoursesForUser(RequestUser user) {
        if (user.isAdmin()) {
            List<Course> courses = courseRepository.findAll();
            courses.sort(COURSE_CODE_ORDER);
            return courses;
        }

        if (user.isTeacher()) {
            List<Course> courses = courseRepository.findByTeacherId(requireLinkedUserId(user));
            courses.sort(COURSE_CODE_ORDER);
            return courses;
        }

        if (user.isStudent()) {
            List<Enrollment> enrollments = enrollmentRepository.findByStudentId(requireLinkedUserId(user));

            Map<UUID, Course> uniqueCourses = new LinkedHashMap<>();
            for (Enrollment enrollment : enrollments) {
                courseRepository.findById(
                                Objects.requireNonNull(enrollment.getCourseId(), "Enrollment course ID is required"))
                        .ifPresent(course -> uniqueCourses.put(course.getId(), course));
            }

            List<Course> courses = new ArrayList<>(uniqueCourses.values());
            courses.sort(COURSE_CODE_ORDER);
            return courses;
        }

        throw new IllegalArgumentException("Invalid role");
    }

    public List<Assignment> getAssignmentsForCourse(UUID courseId) {
        if (courseId == null) {
            throw new IllegalArgumentException("Course is required");
        }
        if (!courseRepository.existsById(courseId)) {
            throw new ResourceNotFoundException("Course not found");
        }

        return assignmentRepository.findByCourseId(courseId);
    }

    public List<Student> getStudentsForCourse(UUID courseId) {
        if (courseId == null) {
            throw new IllegalArgumentException("Course is required");
        }
        if (!courseRepository.existsById(courseId)) {
            throw new ResourceNotFoundException("Course not found");
        }

        List<Enrollment> enrollments = enrollmentRepository.findByCourseId(courseId);
        List<Student> students = new ArrayList<>();

        for (Enrollment enrollment : enrollments) {
            studentRepository.findById(
                            Objects.requireNonNull(enrollment.getStudentId(), "Enrollment student ID is required"))
                    .ifPresent(students::add);
        }

        return students;
    }

    private UUID requireLinkedUserId(RequestUser user) {
        return Objects.requireNonNull(user.getUserId(), "Linked user ID is required");
    }
}
