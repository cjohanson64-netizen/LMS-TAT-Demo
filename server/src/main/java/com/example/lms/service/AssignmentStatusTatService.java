package com.example.lms.service;

import com.example.lms.exception.InvalidSubmissionException;
import com.example.lms.model.RequestUser;
import com.example.lms.tat.AssignmentStatusProjection;
import com.example.lms.tat.AssignmentStatusTatInput;
import com.example.lms.tat.AssignmentStatusTatInputFactory;
import com.example.lms.tat.AssignmentStatusTatModuleBuilder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AssignmentStatusTatService {

    private final AssignmentStatusTatInputFactory inputFactory;
    private final AssignmentStatusTatModuleBuilder moduleBuilder;
    private final TatService tatService;
    private final ObjectMapper objectMapper;

    public AssignmentStatusTatService(
            AssignmentStatusTatInputFactory inputFactory,
            AssignmentStatusTatModuleBuilder moduleBuilder,
            TatService tatService,
            ObjectMapper objectMapper) {
        this.inputFactory = inputFactory;
        this.moduleBuilder = moduleBuilder;
        this.tatService = tatService;
        this.objectMapper = objectMapper;
    }

    public AssignmentStatusProjection getAssignmentStatus(RequestUser user, UUID assignmentId) {
        AssignmentStatusTatInput input = inputFactory.create(user, assignmentId);
        String tatSource = moduleBuilder.build(input);

        String[] lines = tatSource.split("\\R", -1);
        for (int i = 0; i < lines.length; i++) {
            System.out.printf("%3d | %s%n", i + 1, lines[i]);
        }

        System.out.println("=== ASSIGNMENT STATUS TAT SOURCE ===");
        System.out.println(tatSource);
        System.out.println("=== END ASSIGNMENT STATUS TAT SOURCE ===");

        String rawResult = tatService.runTatSource(tatSource);

        try {
            JsonNode root = objectMapper.readTree(rawResult);
            JsonNode projectionNode = root.path("debug").path("projections").path("assignmentStatusGraph");

            if (projectionNode.isMissingNode() || projectionNode.isNull()) {
                throw new InvalidSubmissionException("Assignment status projection was not produced");
            }

            return objectMapper.treeToValue(projectionNode, AssignmentStatusProjection.class);
        } catch (Exception error) {
            throw new InvalidSubmissionException("Failed to parse assignment status projection: " + error.getMessage());
        }
    }
}
