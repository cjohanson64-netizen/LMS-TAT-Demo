package com.example.lms.service;

import com.example.lms.exception.UnauthenticatedException;
import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.AppUser;
import com.example.lms.model.UserRole;
import com.example.lms.repository.AppUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.UUID;

@Service
public class AppUserService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    public AppUserService(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public AppUser createUser(
            String email,
            String rawPassword,
            UserRole role,
            UUID linkedEntityId,
            boolean mustChangePassword
    ) {
        String normalizedEmail = validateNewUserInput(email, rawPassword, role, linkedEntityId);

        if (role == UserRole.ADMIN) {
            linkedEntityId = null;
        }

        AppUser user = new AppUser(
                UUID.randomUUID(),
                normalizedEmail,
                passwordEncoder.encode(rawPassword),
                role,
                linkedEntityId,
                mustChangePassword
        );

        return appUserRepository.save(user);
    }

    public void assertEmailAvailable(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }

        if (appUserRepository.existsByEmail(normalizeEmail(email))) {
            throw new IllegalArgumentException("A user with that email already exists");
        }
    }

    public AppUser authenticate(String email, String rawPassword) {
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }

        AppUser user = appUserRepository.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new UnauthenticatedException("Invalid email or password"));

        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new UnauthenticatedException("Invalid email or password");
        }

        return user;
    }

    public AppUser getById(UUID userId) {
        return appUserRepository.findById(Objects.requireNonNull(userId, "userId is required"))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public AppUser changePassword(UUID userId, String password, String confirmPassword) {
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }
        if (confirmPassword == null || confirmPassword.isBlank()) {
            throw new IllegalArgumentException("Confirm password is required");
        }
        if (!password.equals(confirmPassword)) {
            throw new IllegalArgumentException("Passwords do not match");
        }

        AppUser user = getById(userId);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setMustChangePassword(false);
        return appUserRepository.save(user);
    }

    public AppUser adminResetPassword(
            UserRole role,
            UUID linkedEntityId,
            String password,
            String confirmPassword
    ) {
        if (role == null) {
            throw new IllegalArgumentException("Role is required");
        }
        if (linkedEntityId == null) {
            throw new IllegalArgumentException("Linked entity is required");
        }
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }
        if (confirmPassword == null || confirmPassword.isBlank()) {
            throw new IllegalArgumentException("Confirm password is required");
        }
        if (!password.equals(confirmPassword)) {
            throw new IllegalArgumentException("Passwords do not match");
        }

        AppUser user = appUserRepository.findByRoleAndLinkedEntityId(role, linkedEntityId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setPasswordHash(passwordEncoder.encode(password));
        user.setMustChangePassword(true);
        return appUserRepository.save(user);
    }

    public void updateLinkedUserEmail(UserRole role, UUID linkedEntityId, String email) {
        if (role == null || linkedEntityId == null || email == null || email.trim().isEmpty()) {
            return;
        }

        AppUser user = appUserRepository.findByRoleAndLinkedEntityId(role, linkedEntityId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail.equals(normalizeEmail(user.getEmail())) && appUserRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("A user with that email already exists");
        }

        user.setEmail(normalizedEmail);
        appUserRepository.save(user);
    }

    private String validateNewUserInput(
            String email,
            String rawPassword,
            UserRole role,
            UUID linkedEntityId
    ) {
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }
        if (role == null) {
            throw new IllegalArgumentException("Role is required");
        }

        String normalizedEmail = normalizeEmail(email);

        if (appUserRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("A user with that email already exists");
        }

        if ((role == UserRole.TEACHER || role == UserRole.STUDENT) && linkedEntityId == null) {
            throw new IllegalArgumentException("Linked entity is required for teacher and student users");
        }

        return normalizedEmail;
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }
}
