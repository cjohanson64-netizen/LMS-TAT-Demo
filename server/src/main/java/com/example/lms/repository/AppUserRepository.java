package com.example.lms.repository;

import com.example.lms.model.AppUser;
import com.example.lms.model.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    Optional<AppUser> findByEmail(String email);

    Optional<AppUser> findByRoleAndLinkedEntityId(UserRole role, UUID linkedEntityId);

    boolean existsByEmail(String email);
}