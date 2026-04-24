package com.example.lms.tat;

import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.Assignment;
import com.example.lms.model.Course;
import com.example.lms.model.RequestUser;
import com.example.lms.model.Student;
import com.example.lms.model.Submission;
import com.example.lms.model.Teacher;
import com.example.lms.repository.AssignmentRepository;
import com.example.lms.repository.CourseRepository;
import com.example.lms.repository.StudentRepository;
import com.example.lms.repository.SubmissionRepository;
import com.example.lms.repository.TeacherRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class AssignmentStatusTatInputFactory {

    private final AssignmentRepository assignmentRepository;
    private final CourseRepository courseRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final SubmissionRepository submissionRepository;

    public AssignmentStatusTatInputFactory(
            AssignmentRepository assignmentRepository,
            CourseRepository courseRepository,
            TeacherRepository teacherRepository,
            StudentRepository studentRepository,
            SubmissionRepository submissionRepository
    ) {
        this.assignmentRepository = assignmentRepository;
        this.courseRepository = courseRepository;
        this.teacherRepository = teacherRepository;
        this.studentRepository = studentRepository;
        this.submissionRepository = submissionRepository;
    }

    public AssignmentStatusTatInput create(RequestUser user, UUID assignmentId) {
        if (assignmentId == null) {
            throw new IllegalArgumentException("Assignment is required");
        }
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));

        Course course = courseRepository.findById(
                        Objects.requireNonNull(assignment.getCourseId(), "Assignment course ID is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));

        Teacher teacher = teacherRepository.findById(
                        Objects.requireNonNull(course.getTeacherId(), "Course teacher ID is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found"));

        ViewerContext viewer = new ViewerContext(
                user.isStudent() ? "STUDENT" : "TEACHER",
                user.getUserId() != null ? user.getUserId().toString() : user.getAuthUserId().toString()
        );

        if (user.isStudent()) {
            return createStudentScopedInput(user, viewer, assignment, course, teacher);
        }

        return createTeacherScopedInput(viewer, assignment, course, teacher);
    }

    private AssignmentStatusTatInput createStudentScopedInput(
            RequestUser user,
            ViewerContext viewer,
            Assignment assignment,
            Course course,
            Teacher teacher
    ) {
        UUID studentId = user.getUserId();
        if (studentId == null) {
            throw new IllegalArgumentException("Linked user ID is required");
        }

        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        Submission submission = submissionRepository.findByStudentIdAndAssignmentId(
                Objects.requireNonNull(student.getId(), "Student ID is required"),
                Objects.requireNonNull(assignment.getId(), "Assignment ID is required")
        ).orElse(null);

        List<SubmissionTatNode> submissions = submission == null
                ? List.of()
                : List.of(toSubmissionTatNode(submission));

        return new AssignmentStatusTatInput(
                viewer,
                new AssignmentTatNode(assignment.getId(), assignment.getTitle(), "assignment"),
                new CourseTatNode(course.getId(), course.getTitle(), "course"),
                new TeacherTatNode(teacher.getId(), teacher.getFullName(), "teacher"),
                List.of(new StudentTatNode(student.getId(), student.getFullName(), "student")),
                submissions
        );
    }

    private AssignmentStatusTatInput createTeacherScopedInput(
            ViewerContext viewer,
            Assignment assignment,
            Course course,
            Teacher teacher
    ) {
        List<Submission> rawSubmissions = new ArrayList<>(
                submissionRepository.findByAssignmentId(
                        Objects.requireNonNull(assignment.getId(), "Assignment ID is required"))
        );
        rawSubmissions.sort(Comparator.comparing(Submission::getSubmittedAt));

        List<SubmissionTatNode> submissions = rawSubmissions.stream()
                .map(this::toSubmissionTatNode)
                .toList();

        List<StudentTatNode> students = rawSubmissions.stream()
                .map(Submission::getStudentId)
                .distinct()
                .map((studentId) -> studentRepository.findById(
                                Objects.requireNonNull(studentId, "Submission student ID is required"))
                        .orElseThrow(() -> new ResourceNotFoundException("Student not found")))
                .map((student) -> new StudentTatNode(student.getId(), student.getFullName(), "student"))
                .sorted(Comparator.comparing(StudentTatNode::label, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());

        return new AssignmentStatusTatInput(
                viewer,
                new AssignmentTatNode(assignment.getId(), assignment.getTitle(), "assignment"),
                new CourseTatNode(course.getId(), course.getTitle(), "course"),
                new TeacherTatNode(teacher.getId(), teacher.getFullName(), "teacher"),
                students,
                submissions
        );
    }

    private SubmissionTatNode toSubmissionTatNode(Submission submission) {
        Integer score = submission.getScore();

        return new SubmissionTatNode(
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
