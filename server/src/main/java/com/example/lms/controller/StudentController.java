package com.example.lms.controller;

import com.example.lms.model.RequestUser;
import com.example.lms.model.Student;
import com.example.lms.model.Submission;
import com.example.lms.model.Gender;
import com.example.lms.model.UserRole;
import com.example.lms.service.AppUserService;
import com.example.lms.service.AuthService;
import com.example.lms.service.AuthorizationService;
import com.example.lms.service.StudentService;
import com.example.lms.service.SubmissionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/students")
public class StudentController {

    private final StudentService studentService;
    private final SubmissionService submissionService;
    private final AppUserService appUserService;
    private final AuthService authService;
    private final AuthorizationService authorizationService;

    public StudentController(
            StudentService studentService,
            SubmissionService submissionService,
            AppUserService appUserService,
            AuthService authService,
            AuthorizationService authorizationService
    ) {
        this.studentService = studentService;
        this.submissionService = submissionService;
        this.appUserService = appUserService;
        this.authService = authService;
        this.authorizationService = authorizationService;
    }

    @PostMapping
    public Student createStudent(
            @RequestBody CreateStudentRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        appUserService.assertEmailAvailable(request.email());

        Student student = studentService.createStudent(toStudent(request));
        appUserService.createUser(
                request.email(),
                request.temporaryPassword(),
                UserRole.STUDENT,
                student.getId(),
                true
        );

        return student;
    }

    @GetMapping
    public List<Student> getAllStudents(
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        if (user.isAdmin()) {
            authorizationService.requireAdmin(user);
            return studentService.getAllStudents();
        }

        authorizationService.requireTeacher(user);
        return studentService.getStudentsForTeacher(user.getUserId());
    }

    @GetMapping("/{studentId}/submissions")
    public List<Submission> getStudentSubmissions(
            @PathVariable UUID studentId,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdminOrStudentSelf(user, studentId);

        return submissionService.getStudentSubmissions(studentId);
    }

    @PatchMapping("/{studentId}")
    public Student updateStudent(
            @PathVariable UUID studentId,
            @RequestBody UpdateStudentRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        Student student = studentService.updateStudent(studentId, toStudent(request));
        appUserService.updateLinkedUserEmail(UserRole.STUDENT, studentId, request.email());
        return student;
    }

    @DeleteMapping("/{studentId}")
    public void deleteStudent(
            @PathVariable UUID studentId,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        studentService.deleteStudent(studentId);
    }

    @PostMapping("/{studentId}/reset-password")
    public MessageResponse resetStudentPassword(
            @PathVariable UUID studentId,
            @RequestBody ResetPasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        appUserService.adminResetPassword(
                UserRole.STUDENT,
                studentId,
                request.password(),
                request.confirmPassword()
        );

        return new MessageResponse("Temporary password reset successfully.");
    }

    private Student toStudent(StudentRequest request) {
        return new Student(
                null,
                request.firstName(),
                request.middleName(),
                request.lastName(),
                request.gender(),
                request.dateOfBirth(),
                request.graduationDate(),
                request.email(),
                request.primaryGuardianFirstName(),
                request.primaryGuardianLastName(),
                request.secondaryGuardianFirstName(),
                request.secondaryGuardianLastName(),
                request.primaryGuardianEmail(),
                request.secondaryGuardianEmail(),
                request.primaryAddress(),
                request.secondaryAddress(),
                request.primaryPhone(),
                request.secondaryPhone()
        );
    }

    public record CreateStudentRequest(
            String firstName,
            String middleName,
            String lastName,
            Gender gender,
            LocalDate dateOfBirth,
            LocalDate graduationDate,
            String email,
            String primaryGuardianFirstName,
            String primaryGuardianLastName,
            String secondaryGuardianFirstName,
            String secondaryGuardianLastName,
            String primaryGuardianEmail,
            String secondaryGuardianEmail,
            String primaryAddress,
            String secondaryAddress,
            String primaryPhone,
            String secondaryPhone,
            String temporaryPassword
    ) implements StudentRequest {}

    public record UpdateStudentRequest(
            String firstName,
            String middleName,
            String lastName,
            Gender gender,
            LocalDate dateOfBirth,
            LocalDate graduationDate,
            String email,
            String primaryGuardianFirstName,
            String primaryGuardianLastName,
            String secondaryGuardianFirstName,
            String secondaryGuardianLastName,
            String primaryGuardianEmail,
            String secondaryGuardianEmail,
            String primaryAddress,
            String secondaryAddress,
            String primaryPhone,
            String secondaryPhone
    ) implements StudentRequest {}

    public record ResetPasswordRequest(String password, String confirmPassword) {}
    public record MessageResponse(String message) {}

    private interface StudentRequest {
        String firstName();
        String middleName();
        String lastName();
        Gender gender();
        LocalDate dateOfBirth();
        LocalDate graduationDate();
        String email();
        String primaryGuardianFirstName();
        String primaryGuardianLastName();
        String secondaryGuardianFirstName();
        String secondaryGuardianLastName();
        String primaryGuardianEmail();
        String secondaryGuardianEmail();
        String primaryAddress();
        String secondaryAddress();
        String primaryPhone();
        String secondaryPhone();
    }
}
