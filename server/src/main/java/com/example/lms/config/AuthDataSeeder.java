package com.example.lms.config;

import com.example.lms.model.AppUser;
import com.example.lms.model.UserRole;
import com.example.lms.repository.AppUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

@Configuration
public class AuthDataSeeder {

    @Bean
    CommandLineRunner seedAdminUser(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder
    ) {
        return (args) -> {
            if (appUserRepository.existsByEmail("admin@lms.local")) {
                return;
            }

            AppUser adminUser = new AppUser();
            adminUser.setId(UUID.randomUUID());
            adminUser.setEmail("admin@lms.local");
            adminUser.setPasswordHash(passwordEncoder.encode("admin123"));
            adminUser.setRole(UserRole.ADMIN);
            adminUser.setLinkedEntityId(null);
            adminUser.setMustChangePassword(false);

            appUserRepository.save(adminUser);
        };
    }
}