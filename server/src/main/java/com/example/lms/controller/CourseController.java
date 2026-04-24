package com.example.lms.controller;

import com.example.lms.model.Assignment;
import com.example.lms.model.Course;
import com.example.lms.model.RequestUser;
import com.example.lms.model.Student;
import com.example.lms.service.AuthService;
import com.example.lms.service.AuthorizationService;
import com.example.lms.service.CourseService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/courses")
public class CourseController {

    private final CourseService courseService;
    private final AuthService authService;
    private final AuthorizationService authorizationService;

    public CourseController(
            CourseService courseService,
            AuthService authService,
            AuthorizationService authorizationService
    ) {
        this.courseService = courseService;
        this.authService = authService;
        this.authorizationService = authorizationService;
    }

    @PostMapping
    public Course createCourse(
            @RequestBody CreateCourseRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);

        if (user.isAdmin()) {
            authorizationService.requireAdmin(user);

            return courseService.createCourse(
                    request.title(),
                    request.description(),
                    request.courseCode(),
                    request.teacherId()
            );
        }

        authorizationService.requireTeacher(user);

        return courseService.createCourse(
                request.title(),
                request.description(),
                request.courseCode(),
                user.getUserId()
        );
    }

    @PatchMapping("/{courseId}")
    public Course updateCourse(
            @PathVariable UUID courseId,
            @RequestBody UpdateCourseRequest request,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        return courseService.updateCourse(
                courseId,
                request.title(),
                request.description(),
                request.courseCode(),
                request.teacherId()
        );
    }

    @DeleteMapping("/{courseId}")
    public void deleteCourse(
            @PathVariable UUID courseId,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireAdmin(user);

        courseService.deleteCourse(courseId);
    }

    @GetMapping
    public List<Course> getCourses(HttpServletRequest httpRequest) {
        RequestUser user = authService.getRequestUser(httpRequest);
        return courseService.getCoursesForUser(user);
    }

    @GetMapping("/{courseId}/assignments")
    public List<Assignment> getAssignmentsForCourse(
            @PathVariable UUID courseId,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);

        if (user.isAdmin()) {
            return courseService.getAssignmentsForCourse(courseId);
        } else if (user.isTeacher()) {
            authorizationService.requireTeacherOwnsCourse(user, courseId);
        } else if (user.isStudent()) {
            authorizationService.requireStudentEnrolledInCourse(user, courseId);
        } else {
            throw new IllegalArgumentException("Invalid role");
        }

        return courseService.getAssignmentsForCourse(courseId);
    }

    @GetMapping("/{courseId}/students")
    public List<Student> getStudentsForCourse(
            @PathVariable UUID courseId,
            HttpServletRequest httpRequest
    ) {
        RequestUser user = authService.getRequestUser(httpRequest);
        authorizationService.requireTeacherOwnsCourse(user, courseId);

        return courseService.getStudentsForCourse(courseId);
    }

    public record CreateCourseRequest(
            String title,
            String description,
            String courseCode,
            UUID teacherId
    ) {
    }

    public record UpdateCourseRequest(
            String title,
            String description,
            String courseCode,
            UUID teacherId
    ) {
    }
}
