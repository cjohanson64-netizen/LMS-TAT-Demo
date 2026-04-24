package com.example.lms.controller;

import com.example.lms.model.RequestUser;
import com.example.lms.service.AuthService;
import com.example.lms.service.AuthorizationService;
import com.example.lms.model.Submission;
import com.example.lms.service.SubmissionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/submissions")
public class SubmissionController {

    private final SubmissionService submissionService;
    private final AuthService authService;
    private final AuthorizationService authorizationService;

    public SubmissionController(
            SubmissionService submissionService,
            AuthService authService,
            AuthorizationService authorizationService
    ) {
        this.submissionService = submissionService;
        this.authService = authService;
        this.authorizationService = authorizationService;
    }

    @PostMapping
    public Submission createSubmission(
            @RequestBody CreateSubmissionRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);

        authorizationService.requireStudent(user);

        if (!user.getUserId().equals(request.studentId())) {
            throw new IllegalArgumentException("You may only create submissions for yourself");
        }

        authorizationService.requireStudentCanAccessAssignment(user, request.assignmentId());

        return submissionService.createSubmission(
                request.assignmentId(),
                request.studentId(),
                request.content()
        );
    }

    @PatchMapping("/{submissionId}/grade")
    public Submission gradeSubmission(
            @PathVariable UUID submissionId,
            @RequestBody GradeSubmissionRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireTeacherCanAccessSubmission(user, submissionId);

        return submissionService.gradeSubmission(submissionId, request.score());
    }

    public record CreateSubmissionRequest(
            UUID assignmentId,
            UUID studentId,
            String content
    ) {
    }

    public record GradeSubmissionRequest(Integer score) {
    }
}
