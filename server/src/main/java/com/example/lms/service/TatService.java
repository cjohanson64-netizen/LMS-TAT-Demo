package com.example.lms.service;

import com.example.lms.exception.InvalidSubmissionException;
import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.Assignment;
import com.example.lms.model.Course;
import com.example.lms.model.Student;
import com.example.lms.model.Submission;
import com.example.lms.repository.AssignmentRepository;
import com.example.lms.repository.CourseRepository;
import com.example.lms.repository.StudentRepository;
import com.example.lms.repository.SubmissionRepository;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.FileTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class TatService {

    private static final String TAT_BUILD_DIR = ".tat-build";
    private static final String TAT_BUILD_CONFIG = "tsconfig.build.json";
    private static final Pattern RELATIVE_IMPORT_PATTERN = Pattern.compile("(from\\s+[\"'])(\\.{1,2}/[^\"']+)([\"'])");

    private final SubmissionRepository submissionRepository;
    private final AssignmentRepository assignmentRepository;
    private final StudentRepository studentRepository;
    private final CourseRepository courseRepository;
    private final Object tatRuntimeLock = new Object();

    public TatService(
            SubmissionRepository submissionRepository,
            AssignmentRepository assignmentRepository,
            StudentRepository studentRepository,
            CourseRepository courseRepository) {
        this.submissionRepository = submissionRepository;
        this.assignmentRepository = assignmentRepository;
        this.studentRepository = studentRepository;
        this.courseRepository = courseRepository;
    }

    public String runSubmissionProjection(UUID submissionId) {
        if (submissionId == null) {
            throw new IllegalArgumentException("Submission is required");
        }
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found"));

        Assignment assignment = assignmentRepository.findById(
                Objects.requireNonNull(submission.getAssignmentId(), "Submission assignment ID is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));

        Student student = studentRepository.findById(
                Objects.requireNonNull(submission.getStudentId(), "Submission student ID is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        Course course = courseRepository.findById(
                Objects.requireNonNull(assignment.getCourseId(), "Assignment course ID is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));

        String tatSource = buildSubmissionModule(submission, assignment, student, course);
        System.out.println(tatSource);

        return runTatSource(tatSource);
    }

    public String runTatModule(String modulePath) {
        try {
            Path serverDir = Paths.get("").toAbsolutePath();
            Path repoRoot = serverDir.getParent();

            if (repoRoot == null) {
                throw new InvalidSubmissionException("Could not determine repository root");
            }

            Path runnerPath = repoRoot.resolve("tat").resolve("run-module.ts");
            Path targetModulePath = Paths.get(modulePath).isAbsolute()
                    ? Paths.get(modulePath)
                    : repoRoot.resolve(modulePath);

            ProcessBuilder processBuilder = buildTatProcess(repoRoot, runnerPath, targetModulePath);

            processBuilder.directory(repoRoot.toFile());
            processBuilder.redirectErrorStream(true);

            Process process = processBuilder.start();

            String output;
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                output = reader.lines().collect(Collectors.joining("\n"));
            }

            int exitCode = process.waitFor();

            if (exitCode != 0) {
                throw new InvalidSubmissionException("TAT execution failed: " + output);
            }

            return output;
        } catch (Exception e) {
            throw new InvalidSubmissionException("Failed to execute TAT module: " + e.getMessage());
        }
    }

    private ProcessBuilder buildTatProcess(Path repoRoot, Path runnerPath, Path targetModulePath) {
        if (isExecutableAvailable(repoRoot.resolve("node_modules").resolve(".bin").resolve("tsx"))
                || isExecutableAvailable(
                        repoRoot.resolve("client").resolve("node_modules").resolve(".bin").resolve("tsx"))) {
            return new ProcessBuilder(
                    "npx",
                    "--no-install",
                    "tsx",
                    runnerPath.toString(),
                    targetModulePath.toString(),
                    "--json-only");
        }

        Path compiledRunner = ensureCompiledTatRunner(repoRoot);
        return new ProcessBuilder(
                "node",
                "--experimental-specifier-resolution=node",
                compiledRunner.toString(),
                targetModulePath.toString(),
                "--json-only");
    }

    private Path ensureCompiledTatRunner(Path repoRoot) {
        synchronized (tatRuntimeLock) {
            try {
                Path tatDir = repoRoot.resolve("tat");
                Path buildDir = tatDir.resolve(TAT_BUILD_DIR);
                Path compiledRunner = buildDir.resolve("run-module.js");
                Path buildConfig = tatDir.resolve(TAT_BUILD_CONFIG);

                if (Files.exists(compiledRunner) && !tatSourcesNewerThan(buildDir, tatDir)) {
                    rewriteRelativeImports(buildDir);
                    return compiledRunner;
                }

                Files.createDirectories(buildDir);

                Path tscPath = resolveTscPath(repoRoot);
                ProcessBuilder processBuilder = new ProcessBuilder(
                        tscPath.toString(),
                        "-p",
                        buildConfig.toString());
                processBuilder.directory(repoRoot.toFile());
                processBuilder.redirectErrorStream(true);

                Process process = processBuilder.start();
                String output;
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                    output = reader.lines().collect(Collectors.joining("\n"));
                }

                int exitCode = process.waitFor();
                if (exitCode != 0) {
                    throw new InvalidSubmissionException("TAT TypeScript compilation failed: " + output);
                }

                rewriteRelativeImports(buildDir);

                if (!Files.exists(compiledRunner)) {
                    throw new InvalidSubmissionException("Compiled TAT runner was not produced");
                }

                return compiledRunner;
            } catch (InvalidSubmissionException exception) {
                throw exception;
            } catch (Exception exception) {
                throw new InvalidSubmissionException(
                        "Failed to prepare compiled TAT runner: " + exception.getMessage());
            }
        }
    }

    private boolean tatSourcesNewerThan(Path buildDir, Path tatDir) throws Exception {
        if (!Files.exists(buildDir)) {
            return true;
        }

        FileTime newestBuildTime = Files.walk(buildDir)
                .filter(Files::isRegularFile)
                .map(this::lastModifiedTime)
                .max(FileTime::compareTo)
                .orElse(FileTime.fromMillis(0));

        FileTime newestSourceTime = Files.walk(tatDir)
                .filter(Files::isRegularFile)
                .filter(this::isTatSourceFile)
                .map(this::lastModifiedTime)
                .max(FileTime::compareTo)
                .orElse(FileTime.fromMillis(0));

        return newestSourceTime.compareTo(newestBuildTime) > 0;
    }

    private boolean isTatSourceFile(Path path) {
        String fileName = path.getFileName().toString();
        return fileName.endsWith(".ts") || fileName.equals(TAT_BUILD_CONFIG);
    }

    private FileTime lastModifiedTime(Path path) {
        try {
            return Files.getLastModifiedTime(path);
        } catch (Exception exception) {
            throw new InvalidSubmissionException("Failed to inspect TAT source timestamps: " + exception.getMessage());
        }
    }

    private Path resolveTscPath(Path repoRoot) {
        List<Path> candidates = new ArrayList<>();
        candidates.add(repoRoot.resolve("node_modules").resolve(".bin").resolve("tsc"));
        candidates.add(repoRoot.resolve("client").resolve("node_modules").resolve(".bin").resolve("tsc"));

        for (Path candidate : candidates) {
            if (isExecutableAvailable(candidate)) {
                return candidate;
            }
        }

        throw new InvalidSubmissionException("Could not find a local TypeScript compiler for TAT runtime");
    }

    private boolean isExecutableAvailable(Path path) {
        return Files.exists(path) && Files.isRegularFile(path) && Files.isExecutable(path);
    }

    private void rewriteRelativeImports(Path buildDir) throws Exception {
        try (var paths = Files.walk(buildDir)) {
            for (Path file : paths.filter(Files::isRegularFile).filter((path) -> path.toString().endsWith(".js"))
                    .toList()) {
                String source = Files.readString(file, StandardCharsets.UTF_8);
                Matcher matcher = RELATIVE_IMPORT_PATTERN.matcher(source);
                StringBuffer buffer = new StringBuffer();
                boolean changed = false;

                while (matcher.find()) {
                    String specifier = matcher.group(2);
                    String normalized = specifier.endsWith(".js")
                            || specifier.endsWith(".json")
                            || specifier.endsWith(".mjs")
                                    ? specifier
                                    : specifier + ".js";
                    changed = changed || !normalized.equals(specifier);
                    matcher.appendReplacement(buffer,
                            Matcher.quoteReplacement(matcher.group(1) + normalized + matcher.group(3)));
                }

                if (changed) {
                    matcher.appendTail(buffer);
                    Files.writeString(file, buffer.toString(), StandardCharsets.UTF_8);
                }
            }
        }
    }

    public String runTatSource(String tatSource) {
        try {
            Path tempFile = Files.createTempFile("tat-submission-", ".tat");
            Files.writeString(tempFile, tatSource, StandardCharsets.UTF_8);

            try {
                return runTatModule(tempFile.toAbsolutePath().toString());
            } finally {
                Files.deleteIfExists(tempFile);
            }
        } catch (Exception e) {
            throw new InvalidSubmissionException("Failed to build dynamic TAT module: " + e.getMessage());
        }
    }

    private String buildSubmissionModule(
            Submission submission,
            Assignment assignment,
            Student student,
            Course course) {
        Integer score = submission.getScore();

        String submissionStatus = submission.getStatus().name().toLowerCase();
        String reviewState = score == null ? "needs_grading" : "graded";
        String gradingState = score == null ? "pending" : "complete";
        String feedbackState = score == null ? "awaiting_feedback" : "feedback_ready";
        String masteryLabel = deriveMasteryLabel(score);
        String masteryBand = deriveMasteryBand(score);
        String isPassingLiteral = deriveIsPassingLiteral(score);
        String scoreLiteral = score == null ? "null" : score.toString();

        String studentSemanticId = "student:" + submission.getStudentId();
        String courseSemanticId = "course:" + course.getId();
        String assignmentSemanticId = "assignment:" + assignment.getId();
        String submissionSemanticId = "submission:" + submission.getId();

        return """
                student_node = <{ semanticId: "%s", name: "%s" }>
                course_node = <{ semanticId: "%s", title: "%s" }>
                assignment_node = <{ semanticId: "%s", title: "%s" }>
                submission_node = <{ semanticId: "%s", title: "%s" }>

                @seed:
                  nodes: [
                    student_node,
                    course_node,
                    assignment_node,
                    submission_node
                  ]
                  edges: [
                    enrolledEdge := [student_node : "enrolledIn" : course_node],
                    assignmentEdge := [course_node : "hasAssignment" : assignment_node],
                    submittedEdge := [student_node : "submitted" : submission_node],
                    targetEdge := [submission_node : "forAssignment" : assignment_node]
                  ]
                  state: {
                    submissionStatus: "%s",
                    score: %s
                  }
                  meta: {
                    domain: "lms",
                    kind: "submission"
                  }
                  root: submission_node

                lmsSubmissionGraph := @seed
                  -> @graft.state(submission_node, "reviewState", "%s")
                  -> @graft.state(submission_node, "gradingState", "%s")
                  -> @graft.state(submission_node, "feedbackState", "%s")
                  -> @graft.state(submission_node, "score", %s)
                  -> @graft.state(submission_node, "masteryLabel", "%s")
                  -> @graft.state(submission_node, "masteryBand", "%s")
                  -> @graft.state(submission_node, "isPassing", %s)
                  -> @graft.meta(student_node, "label", "%s")
                  -> @graft.meta(student_node, "type", "student")
                  -> @graft.meta(course_node, "label", "%s")
                  -> @graft.meta(course_node, "type", "course")
                  -> @graft.meta(assignment_node, "label", "%s")
                  -> @graft.meta(assignment_node, "type", "assignment")
                  -> @graft.meta(submission_node, "label", "%s")
                  -> @graft.meta(submission_node, "type", "submission")
                  <> @project(format: "detail", focus: submission_node, include: ["id", "label", "type", "state", "meta", "relationships"])
                """
                .formatted(
                        escapeTat(studentSemanticId),
                        escapeTat(student.getFullName()),
                        escapeTat(courseSemanticId),
                        escapeTat(course.getTitle()),
                        escapeTat(assignmentSemanticId),
                        escapeTat(assignment.getTitle()),
                        escapeTat(submissionSemanticId),
                        escapeTat("Submission " + submission.getId()),
                        escapeTat(submissionStatus),
                        scoreLiteral,
                        escapeTat(reviewState),
                        escapeTat(gradingState),
                        escapeTat(feedbackState),
                        scoreLiteral,
                        escapeTat(masteryLabel),
                        escapeTat(masteryBand),
                        isPassingLiteral,
                        escapeTat(student.getFullName()),
                        escapeTat(course.getTitle()),
                        escapeTat(assignment.getTitle()),
                        escapeTat("Submission " + submission.getId()));
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

    private String deriveIsPassingLiteral(Integer score) {
        if (score == null) {
            return "null";
        }
        return score >= 70 ? "true" : "false";
    }

    private String escapeTat(String value) {
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
}
