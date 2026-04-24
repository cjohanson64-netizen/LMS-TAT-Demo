package com.example.lms.controller;

import com.example.lms.model.Assignment;
import com.example.lms.model.RequestUser;
import com.example.lms.model.Submission;
import com.example.lms.service.AssignmentService;
import com.example.lms.service.AuthService;
import com.example.lms.service.AuthorizationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/assignments")
public class AssignmentController {

    private final AssignmentService assignmentService;
    private final AuthService authService;
    private final AuthorizationService authorizationService;

    public AssignmentController(
            AssignmentService assignmentService,
            AuthService authService,
            AuthorizationService authorizationService
    ) {
        this.assignmentService = assignmentService;
        this.authService = authService;
        this.authorizationService = authorizationService;
    }

    @PostMapping
    public Assignment createAssignment(
            @RequestBody CreateAssignmentRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);

        authorizationService.requireTeacher(user);
        authorizationService.requireTeacherOwnsCourse(user, request.courseId());

        return assignmentService.createAssignment(
                request.courseId(),
                request.title(),
                request.description(),
                request.dueDate(),
                request.pointsPossible()
        );
    }

    @GetMapping("/{assignmentId}/submissions")
    public List<Submission> getSubmissionsForAssignment(
            @PathVariable UUID assignmentId,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);

        authorizationService.requireTeacher(user);
        authorizationService.requireTeacherOwnsAssignment(user, assignmentId);

        return assignmentService.getSubmissionsForAssignment(assignmentId);
    }

    @DeleteMapping("/{assignmentId}")
    public void deleteAssignment(
            @PathVariable UUID assignmentId,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);

        authorizationService.requireTeacher(user);
        authorizationService.requireTeacherOwnsAssignment(user, assignmentId);

        assignmentService.deleteAssignment(assignmentId);
    }

    public record CreateAssignmentRequest(
            UUID courseId,
            String title,
            String description,
            LocalDateTime dueDate,
            Integer pointsPossible
    ) {
    }
}
