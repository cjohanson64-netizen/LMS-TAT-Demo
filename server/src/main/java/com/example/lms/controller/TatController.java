package com.example.lms.controller;

import com.example.lms.model.RequestUser;
import com.example.lms.tat.AssignmentStatusProjection;
import com.example.lms.service.AuthService;
import com.example.lms.service.AssignmentStatusTatService;
import com.example.lms.service.AuthorizationService;
import com.example.lms.service.TatService;
import com.example.lms.tat.CourseAssignmentSummaryProjection;
import com.example.lms.service.CourseAssignmentSummaryTatService;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/tat")
public class TatController {

    private final TatService tatService;
    private final AssignmentStatusTatService assignmentStatusTatService;
    private final AuthService authService;
    private final AuthorizationService authorizationService;
    private final CourseAssignmentSummaryTatService courseAssignmentSummaryTatService;

    public TatController(
            TatService tatService,
            AssignmentStatusTatService assignmentStatusTatService,
            CourseAssignmentSummaryTatService courseAssignmentSummaryTatService,
            AuthService authService,
            AuthorizationService authorizationService) {
        this.tatService = tatService;
        this.assignmentStatusTatService = assignmentStatusTatService;
        this.courseAssignmentSummaryTatService = courseAssignmentSummaryTatService;
        this.authService = authService;
        this.authorizationService = authorizationService;
    }

    @GetMapping(value = "/submission/{submissionId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getSubmissionProjection(
            @PathVariable UUID submissionId,
            HttpServletRequest request) {
        RequestUser user = authService.getRequestUser(request);
        authorizationService.requireCanAccessSubmission(user, submissionId);
        return tatService.runSubmissionProjection(submissionId);
    }

    @GetMapping(value = "/assignments/{assignmentId}/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public AssignmentStatusProjection getAssignmentStatusProjection(
            @PathVariable UUID assignmentId,
            HttpServletRequest request) {
        RequestUser user = authService.getRequestUser(request);
        authorizationService.requireCanAccessAssignment(user, assignmentId);
        return assignmentStatusTatService.getAssignmentStatus(user, assignmentId);
    }

    @GetMapping(value = "/courses/{courseId}/assignment-summary", produces = MediaType.APPLICATION_JSON_VALUE)
    public CourseAssignmentSummaryProjection getCourseAssignmentSummaryProjection(
            @PathVariable UUID courseId,
            HttpServletRequest request) {
        RequestUser user = authService.getRequestUser(request);
        authorizationService.requireCanAccessCourse(user, courseId);

        return courseAssignmentSummaryTatService.getCourseAssignmentSummary(user, courseId);
    }
}
