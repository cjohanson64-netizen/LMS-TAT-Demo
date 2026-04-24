package com.example.lms.controller;

import com.example.lms.model.Enrollment;
import com.example.lms.model.RequestUser;
import com.example.lms.service.AuthService;
import com.example.lms.service.AuthorizationService;
import com.example.lms.service.EnrollmentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/enrollments")
public class EnrollmentController {

    private final EnrollmentService enrollmentService;
    private final AuthService authService;
    private final AuthorizationService authorizationService;

    public EnrollmentController(
            EnrollmentService enrollmentService,
            AuthService authService,
            AuthorizationService authorizationService
    ) {
        this.enrollmentService = enrollmentService;
        this.authService = authService;
        this.authorizationService = authorizationService;
    }

    @PostMapping
    public Enrollment enrollStudent(
            @RequestBody CreateEnrollmentRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdminOrTeacher(user);
        authorizationService.requireTeacherOwnsCourse(user, request.courseId());

        return enrollmentService.enrollStudent(request.studentId(), request.courseId());
    }

    public record CreateEnrollmentRequest(UUID studentId, UUID courseId) {
    }
}
