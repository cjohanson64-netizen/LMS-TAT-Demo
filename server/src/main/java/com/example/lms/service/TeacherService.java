package com.example.lms.service;

import com.example.lms.exception.ResourceNotFoundException;
import com.example.lms.model.Teacher;
import com.example.lms.repository.TeacherRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class TeacherService {

    private final TeacherRepository teacherRepository;

    public TeacherService(TeacherRepository teacherRepository) {
        this.teacherRepository = teacherRepository;
    }

    public Teacher createTeacher(Teacher teacherData) {
        Teacher teacher = new Teacher();
        teacher.setId(UUID.randomUUID());
        applyTeacherProfile(teacher, teacherData);
        return teacherRepository.save(teacher);
    }

    public List<Teacher> getAllTeachers() {
        return teacherRepository.findAll();
    }

    public Teacher updateTeacher(UUID teacherId, Teacher teacherData) {
        if (teacherId == null) {
            throw new IllegalArgumentException("Teacher is required");
        }
        Teacher teacher = teacherRepository.findById(teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found"));

        applyTeacherProfile(teacher, teacherData);
        return teacherRepository.save(Objects.requireNonNull(teacher));
    }

    public void deleteTeacher(UUID teacherId) {
        if (teacherId == null) {
            throw new IllegalArgumentException("Teacher is required");
        }
        if (!teacherRepository.existsById(teacherId)) {
            throw new ResourceNotFoundException("Teacher not found");
        }

        teacherRepository.deleteById(Objects.requireNonNull(teacherId));
    }

    private void applyTeacherProfile(Teacher teacher, Teacher source) {
        if (source == null) {
            throw new IllegalArgumentException("Teacher details are required");
        }

        teacher.setFirstName(requireText(source.getFirstName(), "Teacher first name is required"));
        teacher.setMiddleName(normalizeOptionalText(source.getMiddleName()));
        teacher.setLastName(requireText(source.getLastName(), "Teacher last name is required"));
        teacher.setGender(requireValue(source.getGender(), "Teacher gender is required"));
        teacher.setDateOfBirth(requireValue(source.getDateOfBirth(), "Teacher date of birth is required"));
        teacher.setEmail(requireText(source.getEmail(), "Teacher email is required"));
        teacher.setPrimaryAddress(normalizeOptionalText(source.getPrimaryAddress()));
        teacher.setSecondaryAddress(normalizeOptionalText(source.getSecondaryAddress()));
        teacher.setPrimaryPhone(normalizeOptionalText(source.getPrimaryPhone()));
        teacher.setSecondaryPhone(normalizeOptionalText(source.getSecondaryPhone()));
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(message);
        }

        return value.trim();
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private <T> T requireValue(T value, String message) {
        if (value == null) {
            throw new IllegalArgumentException(message);
        }

        return value;
    }
}
