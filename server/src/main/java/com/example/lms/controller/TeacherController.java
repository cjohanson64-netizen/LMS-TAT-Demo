package com.example.lms.controller;

import com.example.lms.model.RequestUser;
import com.example.lms.model.Teacher;
import com.example.lms.model.Gender;
import com.example.lms.model.UserRole;
import com.example.lms.service.AppUserService;
import com.example.lms.service.AuthService;
import com.example.lms.service.AuthorizationService;
import com.example.lms.service.TeacherService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/teachers")
public class TeacherController {

    private final TeacherService teacherService;
    private final AppUserService appUserService;
    private final AuthService authService;
    private final AuthorizationService authorizationService;

    public TeacherController(
            TeacherService teacherService,
            AppUserService appUserService,
            AuthService authService,
            AuthorizationService authorizationService
    ) {
        this.teacherService = teacherService;
        this.appUserService = appUserService;
        this.authService = authService;
        this.authorizationService = authorizationService;
    }

    @PostMapping
    public Teacher createTeacher(
            @RequestBody CreateTeacherRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        appUserService.assertEmailAvailable(request.email());

        Teacher teacher = teacherService.createTeacher(toTeacher(request));
        appUserService.createUser(
                request.email(),
                request.temporaryPassword(),
                UserRole.TEACHER,
                teacher.getId(),
                true
        );

        return teacher;
    }

    @GetMapping
    public List<Teacher> getAllTeachers(
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        return teacherService.getAllTeachers();
    }

    @PatchMapping("/{teacherId}")
    public Teacher updateTeacher(
            @PathVariable UUID teacherId,
            @RequestBody UpdateTeacherRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        Teacher teacher = teacherService.updateTeacher(teacherId, toTeacher(request));
        appUserService.updateLinkedUserEmail(UserRole.TEACHER, teacherId, request.email());
        return teacher;
    }

    @DeleteMapping("/{teacherId}")
    public void deleteTeacher(
            @PathVariable UUID teacherId,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        teacherService.deleteTeacher(teacherId);
    }

    @PostMapping("/{teacherId}/reset-password")
    public MessageResponse resetTeacherPassword(
            @PathVariable UUID teacherId,
            @RequestBody ResetPasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        appUserService.adminResetPassword(
                UserRole.TEACHER,
                teacherId,
                request.password(),
                request.confirmPassword()
        );

        return new MessageResponse("Temporary password reset successfully.");
    }

    private Teacher toTeacher(TeacherRequest request) {
        return new Teacher(
                null,
                request.firstName(),
                request.middleName(),
                request.lastName(),
                request.gender(),
                request.dateOfBirth(),
                request.email(),
                request.primaryAddress(),
                request.secondaryAddress(),
                request.primaryPhone(),
                request.secondaryPhone()
        );
    }

    public record CreateTeacherRequest(
            String firstName,
            String middleName,
            String lastName,
            Gender gender,
            LocalDate dateOfBirth,
            String email,
            String primaryAddress,
            String secondaryAddress,
            String primaryPhone,
            String secondaryPhone,
            String temporaryPassword
    ) implements TeacherRequest {}

    public record UpdateTeacherRequest(
            String firstName,
            String middleName,
            String lastName,
            Gender gender,
            LocalDate dateOfBirth,
            String email,
            String primaryAddress,
            String secondaryAddress,
            String primaryPhone,
            String secondaryPhone
    ) implements TeacherRequest {}

    public record ResetPasswordRequest(String password, String confirmPassword) {}
    public record MessageResponse(String message) {}

    private interface TeacherRequest {
        String firstName();
        String middleName();
        String lastName();
        Gender gender();
        LocalDate dateOfBirth();
        String email();
        String primaryAddress();
        String secondaryAddress();
        String primaryPhone();
        String secondaryPhone();
    }
}
