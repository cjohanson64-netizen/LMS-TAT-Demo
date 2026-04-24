package com.example.lms.service;

import com.example.lms.exception.InvalidSubmissionException;
import com.example.lms.model.RequestUser;
import com.example.lms.tat.CourseAssignmentSummaryProjection;
import com.example.lms.tat.CourseAssignmentSummaryTatInput;
import com.example.lms.tat.CourseAssignmentSummaryTatInputFactory;
import com.example.lms.tat.CourseAssignmentSummaryTatModuleBuilder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class CourseAssignmentSummaryTatService {

    private final CourseAssignmentSummaryTatInputFactory inputFactory;
    private final CourseAssignmentSummaryTatModuleBuilder moduleBuilder;
    private final TatService tatService;
    private final ObjectMapper objectMapper;

    public CourseAssignmentSummaryTatService(
            CourseAssignmentSummaryTatInputFactory inputFactory,
            CourseAssignmentSummaryTatModuleBuilder moduleBuilder,
            TatService tatService,
            ObjectMapper objectMapper) {
        this.inputFactory = inputFactory;
        this.moduleBuilder = moduleBuilder;
        this.tatService = tatService;
        this.objectMapper = objectMapper;
    }

    public CourseAssignmentSummaryProjection getCourseAssignmentSummary(
            RequestUser user,
            UUID courseId) {
        CourseAssignmentSummaryTatInput input = inputFactory.create(user, courseId);
        String tatSource = moduleBuilder.build(input);
        String[] lines = tatSource.split("\\R", -1);
        for (int i = 0; i < lines.length; i++) {
            System.out.printf("%3d | %s%n", i + 1, lines[i]);
        }
        System.out.println(tatSource);
        String rawResult = tatService.runTatSource(tatSource);

        try {
            JsonNode root = objectMapper.readTree(rawResult);

            JsonNode projectionNode = root
                    .path("debug")
                    .path("projections")
                    .path("course_assignment_summary");

            if (projectionNode.isMissingNode() || projectionNode.isNull()) {
                projectionNode = root
                        .path("debug")
                        .path("projections")
                        .path("graph");
            }

            if (projectionNode.isMissingNode() || projectionNode.isNull()) {
                throw new InvalidSubmissionException("Course assignment summary projection was not produced");
            }

            CourseAssignmentSummaryProjection baseProjection = objectMapper.treeToValue(projectionNode,
                    CourseAssignmentSummaryProjection.class);

            return new CourseAssignmentSummaryProjection(
                    baseProjection.course(),
                    baseProjection.viewer(),
                    baseProjection.assignmentNodes(),
                    input.assignments().stream()
                            .map((assignment) -> new CourseAssignmentSummaryProjection.AssignmentSummary(
                                    assignment.id().toString(),
                                    assignment.label(),
                                    assignment.submissionCount(),
                                    assignment.gradedCount(),
                                    assignment.ungradedCount(),
                                    new CourseAssignmentSummaryProjection.Status(
                                            assignment.statusCode(),
                                            assignment.statusLabel(),
                                            assignment.statusTone()),
                                    new CourseAssignmentSummaryProjection.NextAction(
                                            assignment.nextActionCode(),
                                            assignment.nextActionLabel())))
                            .toList());
        } catch (Exception error) {
            throw new InvalidSubmissionException(
                    "Failed to parse course assignment summary projection: " + error.getMessage());
        }
    }
}