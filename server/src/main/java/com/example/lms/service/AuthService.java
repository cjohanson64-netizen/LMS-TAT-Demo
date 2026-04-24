package com.example.lms.service;

import com.example.lms.exception.UnauthenticatedException;
import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.AppUser;
import com.example.lms.model.RequestUser;
import com.example.lms.model.Student;
import com.example.lms.model.Teacher;
import com.example.lms.model.UserRole;
import com.example.lms.repository.AppUserRepository;
import com.example.lms.repository.CourseRepository;
import com.example.lms.repository.EnrollmentRepository;
import com.example.lms.repository.StudentRepository;
import com.example.lms.repository.TeacherRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.UUID;

@Service
public class AuthService {

    public static final String SESSION_AUTH_USER_ID = "authUserId";
    public static final String SESSION_ACTING_AS_ROLE = "actingAsRole";
    public static final String SESSION_ACTING_AS_LINKED_ENTITY_ID = "actingAsLinkedEntityId";

    private final AppUserRepository appUserRepository;
    private final AppUserService appUserService;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;

    public AuthService(
            AppUserRepository appUserRepository,
            AppUserService appUserService,
            TeacherRepository teacherRepository,
            StudentRepository studentRepository,
            CourseRepository courseRepository,
            EnrollmentRepository enrollmentRepository
    ) {
        this.appUserRepository = appUserRepository;
        this.appUserService = appUserService;
        this.teacherRepository = teacherRepository;
        this.studentRepository = studentRepository;
        this.courseRepository = courseRepository;
        this.enrollmentRepository = enrollmentRepository;
    }

    public RequestUser getRequestUser(HttpServletRequest request) {
        HttpSession session = requireSession(request);
        AppUser appUser = requireAuthenticatedAppUser(session);

        UserRole realRole = Objects.requireNonNull(appUser.getRole(), "Authenticated user role is required");
        UUID realLinkedEntityId = requireLinkedEntityId(appUser, realRole);

        UserRole effectiveRole = realRole;
        UUID effectiveLinkedEntityId = realLinkedEntityId;
        boolean impersonating = false;

        Object actingAsRoleRaw = session.getAttribute(SESSION_ACTING_AS_ROLE);
        Object actingAsLinkedEntityIdRaw = session.getAttribute(SESSION_ACTING_AS_LINKED_ENTITY_ID);

        if (actingAsRoleRaw != null || actingAsLinkedEntityIdRaw != null) {
            effectiveRole = parseRole(actingAsRoleRaw);
            effectiveLinkedEntityId = parseRequiredUuid(
                    actingAsLinkedEntityIdRaw,
                    "Invalid impersonation session");

            if (effectiveRole == UserRole.ADMIN) {
                throw new UnauthenticatedException("Invalid impersonation session");
            }

            validateTargetExists(effectiveRole, effectiveLinkedEntityId);
            impersonating = true;
        }

        return new RequestUser(
                Objects.requireNonNull(appUser.getId(), "Authenticated user ID is required"),
                realRole,
                effectiveRole,
                effectiveLinkedEntityId,
                impersonating
        );
    }

    public void signIn(HttpServletRequest request, AppUser appUser) {
        HttpSession session = request.getSession(true);
        session.setAttribute(SESSION_AUTH_USER_ID, appUser.getId().toString());
        clearImpersonation(session);
    }

    public void signOut(HttpServletRequest request) {
        HttpSession session = request.getSession(false);

        if (session != null) {
            session.invalidate();
        }
    }

    public AppUser getAuthenticatedAppUser(HttpServletRequest request) {
        return requireAuthenticatedAppUser(requireSession(request));
    }

    public RequestUser toRequestUser(AppUser appUser) {
        UserRole role = Objects.requireNonNull(appUser.getRole(), "Authenticated user role is required");
        return new RequestUser(
                Objects.requireNonNull(appUser.getId(), "Authenticated user ID is required"),
                role,
                role,
                requireLinkedEntityId(appUser, role),
                false
        );
    }

    public RequestUser startViewAs(
            HttpServletRequest request,
            UserRole role,
            UUID linkedEntityId
    ) {
        if (role == null) {
            throw new IllegalArgumentException("Role is required");
        }
        if (linkedEntityId == null) {
            throw new IllegalArgumentException("Linked entity is required");
        }
        if (role == UserRole.ADMIN) {
            throw new IllegalArgumentException("Cannot view as ADMIN");
        }

        HttpSession session = requireSession(request);
        AppUser appUser = requireAuthenticatedAppUser(session);
        UserRole realRole = Objects.requireNonNull(appUser.getRole(), "Authenticated user role is required");

        if (realRole == UserRole.ADMIN) {
            validateTargetExists(role, linkedEntityId);
        } else if (realRole == UserRole.TEACHER) {
            if (role != UserRole.STUDENT) {
                throw new IllegalArgumentException("Teachers may only view as students");
            }

            UUID teacherId = requireLinkedEntityId(appUser, realRole);
            Student student = studentRepository.findById(linkedEntityId)
                    .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

            if (!teacherCanViewStudent(teacherId, Objects.requireNonNull(student.getId(), "Student ID is required"))) {
                throw new IllegalArgumentException("You may only view students enrolled in your courses");
            }
        } else if (realRole == UserRole.STUDENT) {
            throw new IllegalArgumentException("Students may not use View As");
        } else {
            throw new IllegalArgumentException("Unsupported role");
        }

        session.setAttribute(SESSION_ACTING_AS_ROLE, role.name());
        session.setAttribute(SESSION_ACTING_AS_LINKED_ENTITY_ID, linkedEntityId.toString());
        return getRequestUser(request);
    }

    public RequestUser stopViewAs(HttpServletRequest request) {
        HttpSession session = requireSession(request);
        requireAuthenticatedAppUser(session);
        clearImpersonation(session);
        return getRequestUser(request);
    }

    public AppUser changePassword(
            HttpServletRequest request,
            String password,
            String confirmPassword
    ) {
        AppUser appUser = getAuthenticatedAppUser(request);
        UUID authUserId = Objects.requireNonNull(appUser.getId(), "Authenticated user ID is required");
        return appUserService.changePassword(authUserId, password, confirmPassword);
    }

    public String getEffectiveDisplayName(RequestUser requestUser, AppUser appUser) {
        return resolveDisplayName(
                requestUser.getEffectiveRole(),
                requestUser.getLinkedEntityId(),
                appUser.getEmail()
        );
    }

    private HttpSession requireSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);

        if (session == null) {
            throw new UnauthenticatedException("Not authenticated");
        }

        return session;
    }

    private AppUser requireAuthenticatedAppUser(HttpSession session) {
        UUID authUserId = parseRequiredUuid(
                session.getAttribute(SESSION_AUTH_USER_ID),
                "Invalid authenticated session");

        return appUserRepository.findById(Objects.requireNonNull(authUserId, "authUserId is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }

    private UUID parseRequiredUuid(Object rawValue, String errorMessage) {
        if (!(rawValue instanceof String value) || value.isBlank()) {
            throw new UnauthenticatedException(errorMessage);
        }

        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            throw new UnauthenticatedException(errorMessage);
        }
    }

    private UserRole parseRole(Object rawValue) {
        if (!(rawValue instanceof String value) || value.isBlank()) {
            throw new UnauthenticatedException("Invalid impersonation session");
        }

        try {
            return UserRole.valueOf(value);
        } catch (IllegalArgumentException ex) {
            throw new UnauthenticatedException("Invalid impersonation session");
        }
    }

    private UUID requireLinkedEntityId(AppUser appUser, UserRole role) {
        if (role == UserRole.ADMIN) {
            return null;
        }

        UUID linkedEntityId = appUser.getLinkedEntityId();
        if (linkedEntityId == null) {
            throw new IllegalArgumentException("Authenticated user is missing linked domain identity");
        }

        return linkedEntityId;
    }

    private void validateTargetExists(UserRole role, UUID linkedEntityId) {
        if (role == UserRole.TEACHER) {
            Teacher teacher = teacherRepository.findById(
                            Objects.requireNonNull(linkedEntityId, "Teacher ID is required"))
                    .orElseThrow(() -> new ResourceNotFoundException("Teacher not found"));
            Objects.requireNonNull(teacher.getId(), "Teacher ID is required");
            return;
        }

        if (role == UserRole.STUDENT) {
            Student student = studentRepository.findById(
                            Objects.requireNonNull(linkedEntityId, "Student ID is required"))
                    .orElseThrow(() -> new ResourceNotFoundException("Student not found"));
            Objects.requireNonNull(student.getId(), "Student ID is required");
            return;
        }

        throw new IllegalArgumentException("Cannot view as " + role.name());
    }

    private boolean teacherCanViewStudent(UUID teacherId, UUID studentId) {
        return courseRepository.findByTeacherId(teacherId).stream()
                .map((course) -> Objects.requireNonNull(course.getId(), "Course ID is required"))
                .anyMatch((courseId) -> enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId));
    }

    private String resolveDisplayName(UserRole role, UUID linkedEntityId, String fallbackEmail) {
        if (role == UserRole.TEACHER && linkedEntityId != null) {
            return teacherRepository.findById(linkedEntityId)
                    .map(Teacher::getFullName)
                    .orElse(fallbackEmail);
        }

        if (role == UserRole.STUDENT && linkedEntityId != null) {
            return studentRepository.findById(linkedEntityId)
                    .map(Student::getFullName)
                    .orElse(fallbackEmail);
        }

        return fallbackEmail;
    }

    private void clearImpersonation(HttpSession session) {
        session.removeAttribute(SESSION_ACTING_AS_ROLE);
        session.removeAttribute(SESSION_ACTING_AS_LINKED_ENTITY_ID);
    }
}
