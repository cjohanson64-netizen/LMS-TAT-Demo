package com.example.lms.controller;

import com.example.lms.model.AppUser;
import com.example.lms.model.RequestUser;
import com.example.lms.model.UserRole;
import com.example.lms.service.AppUserService;
import com.example.lms.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AppUserService appUserService;
    private final AuthService authService;

    public AuthController(
            AppUserService appUserService,
            AuthService authService
    ) {
        this.appUserService = appUserService;
        this.authService = authService;
    }

    @PostMapping("/login")
    public AuthUserResponse login(
            @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        AppUser appUser = appUserService.authenticate(request.email(), request.password());
        authService.signIn(httpRequest, appUser);
        return toAuthUserResponse(authService.getRequestUser(httpRequest), appUser);
    }

    @PostMapping("/logout")
    public MessageResponse logout(HttpServletRequest httpRequest) {
        authService.signOut(httpRequest);
        return new MessageResponse("Logged out successfully");
    }

    @GetMapping("/me")
    public AuthUserResponse me(HttpServletRequest httpRequest) {
        AppUser appUser = authService.getAuthenticatedAppUser(httpRequest);
        return toAuthUserResponse(authService.getRequestUser(httpRequest), appUser);
    }

    @PostMapping("/view-as")
    public AuthUserResponse viewAs(
            @RequestBody ViewAsRequest request,
            HttpServletRequest httpRequest
    ) {
        AppUser appUser = authService.getAuthenticatedAppUser(httpRequest);
        RequestUser requestUser = authService.startViewAs(
                httpRequest,
                request.role(),
                request.linkedEntityId()
        );
        return toAuthUserResponse(requestUser, appUser);
    }

    @PostMapping("/stop-view-as")
    public AuthUserResponse stopViewAs(HttpServletRequest httpRequest) {
        AppUser appUser = authService.getAuthenticatedAppUser(httpRequest);
        RequestUser requestUser = authService.stopViewAs(httpRequest);
        return toAuthUserResponse(requestUser, appUser);
    }

    @PostMapping("/change-password")
    public AuthUserResponse changePassword(
            @RequestBody ChangePasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        AppUser appUser = authService.changePassword(
                httpRequest,
                request.password(),
                request.confirmPassword()
        );
        return toAuthUserResponse(authService.getRequestUser(httpRequest), appUser);
    }

    private AuthUserResponse toAuthUserResponse(RequestUser requestUser, AppUser appUser) {
        return new AuthUserResponse(
                appUser.getId(),
                appUser.getEmail(),
                requestUser.getRealRole().name(),
                requestUser.getEffectiveRole().name(),
                requestUser.getLinkedEntityId(),
                requestUser.isImpersonating(),
                authService.getEffectiveDisplayName(requestUser, appUser),
                appUser.isMustChangePassword()
        );
    }

    public record LoginRequest(String email, String password) {
    }

    public record ViewAsRequest(
            UserRole role,
            UUID linkedEntityId
    ) {
    }

    public record ChangePasswordRequest(
            String password,
            String confirmPassword
    ) {
    }

    public record AuthUserResponse(
            UUID id,
            String email,
            String realRole,
            String effectiveRole,
            UUID linkedEntityId,
            boolean isImpersonating,
            String effectiveDisplayName,
            boolean mustChangePassword
    ) {
    }

    public record MessageResponse(String message) {
    }
}
