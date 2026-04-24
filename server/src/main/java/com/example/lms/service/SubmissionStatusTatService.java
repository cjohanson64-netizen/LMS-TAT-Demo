package com.example.lms.service;

import com.example.lms.exception.InvalidSubmissionException;
import com.example.lms.model.RequestUser;
import com.example.lms.tat.SubmissionStatusProjection;
import com.example.lms.tat.SubmissionStatusTatInput;
import com.example.lms.tat.SubmissionStatusTatInputFactory;
import com.example.lms.tat.SubmissionStatusTatModuleBuilder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class SubmissionStatusTatService {

    private final SubmissionStatusTatInputFactory inputFactory;
    private final SubmissionStatusTatModuleBuilder moduleBuilder;
    private final TatService tatService;
    private final ObjectMapper objectMapper;

    public SubmissionStatusTatService(
            SubmissionStatusTatInputFactory inputFactory,
            SubmissionStatusTatModuleBuilder moduleBuilder,
            TatService tatService,
            ObjectMapper objectMapper) {
        this.inputFactory = inputFactory;
        this.moduleBuilder = moduleBuilder;
        this.tatService = tatService;
        this.objectMapper = objectMapper;
    }

    public SubmissionStatusProjection getSubmissionStatus(RequestUser user, UUID submissionId) {
        SubmissionStatusTatInput input = inputFactory.create(user, submissionId);
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
                    .path("graph");

            if (projectionNode.isMissingNode() || projectionNode.isNull()) {
                projectionNode = root
                        .path("debug")
                        .path("projections")
                        .path("submission_status");
            }

            if (projectionNode.isMissingNode() || projectionNode.isNull()) {
                throw new InvalidSubmissionException("Submission status projection was not produced");
            }

            return objectMapper.treeToValue(projectionNode, SubmissionStatusProjection.class);
        } catch (Exception error) {
            throw new InvalidSubmissionException("Failed to parse submission status projection: " + error.getMessage());
        }
    }
}