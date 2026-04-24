package com.example.lms.model;

import java.util.UUID;

public class RequestUser {

    private final UUID authUserId;
    private final UserRole realRole;
    private final UserRole effectiveRole;
    private final UUID linkedEntityId;
    private final boolean impersonating;

    public RequestUser(
            UUID authUserId,
            UserRole realRole,
            UserRole effectiveRole,
            UUID linkedEntityId,
            boolean impersonating
    ) {
        this.authUserId = authUserId;
        this.realRole = realRole;
        this.effectiveRole = effectiveRole;
        this.linkedEntityId = linkedEntityId;
        this.impersonating = impersonating;
    }

    public UUID getAuthUserId() {
        return authUserId;
    }

    public UserRole getRole() {
        return effectiveRole;
    }

    public UserRole getRealRole() {
        return realRole;
    }

    public UserRole getEffectiveRole() {
        return effectiveRole;
    }

    public UUID getLinkedEntityId() {
        return linkedEntityId;
    }

    public UUID getUserId() {
        return linkedEntityId;
    }

    public boolean isAdmin() {
        return effectiveRole == UserRole.ADMIN;
    }

    public boolean isTeacher() {
        return effectiveRole == UserRole.TEACHER;
    }

    public boolean isStudent() {
        return effectiveRole == UserRole.STUDENT;
    }

    public boolean realUserIsAdmin() {
        return realRole == UserRole.ADMIN;
    }

    public boolean realUserIsTeacher() {
        return realRole == UserRole.TEACHER;
    }

    public boolean realUserIsStudent() {
        return realRole == UserRole.STUDENT;
    }

    public boolean isImpersonating() {
        return impersonating;
    }
}
