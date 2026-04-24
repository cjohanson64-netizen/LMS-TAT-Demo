package com.example.lms.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "students")
public class Student {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column
    private String middleName;

    @Column(nullable = false)
    private String lastName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Gender gender;

    @Column(nullable = false)
    private LocalDate dateOfBirth;

    @Column(nullable = false)
    private LocalDate graduationDate;

    @Column(nullable = false)
    private String primaryGuardianFirstName;

    @Column(nullable = false)
    private String primaryGuardianLastName;

    @Column
    private String secondaryGuardianFirstName;

    @Column
    private String secondaryGuardianLastName;

    @Column
    private String primaryGuardianEmail;

    @Column
    private String secondaryGuardianEmail;

    @Column
    private String primaryAddress;

    @Column
    private String secondaryAddress;

    @Column
    private String primaryPhone;

    @Column
    private String secondaryPhone;

    public Student() {
    }

    public Student(
            UUID id,
            String firstName,
            String middleName,
            String lastName,
            Gender gender,
            LocalDate dateOfBirth,
            LocalDate graduationDate,
            String email,
            String primaryGuardianFirstName,
            String primaryGuardianLastName,
            String secondaryGuardianFirstName,
            String secondaryGuardianLastName,
            String primaryGuardianEmail,
            String secondaryGuardianEmail,
            String primaryAddress,
            String secondaryAddress,
            String primaryPhone,
            String secondaryPhone
    ) {
        this.id = id;
        this.firstName = firstName;
        this.middleName = middleName;
        this.lastName = lastName;
        this.gender = gender;
        this.dateOfBirth = dateOfBirth;
        this.graduationDate = graduationDate;
        this.email = email;
        this.primaryGuardianFirstName = primaryGuardianFirstName;
        this.primaryGuardianLastName = primaryGuardianLastName;
        this.secondaryGuardianFirstName = secondaryGuardianFirstName;
        this.secondaryGuardianLastName = secondaryGuardianLastName;
        this.primaryGuardianEmail = primaryGuardianEmail;
        this.secondaryGuardianEmail = secondaryGuardianEmail;
        this.primaryAddress = primaryAddress;
        this.secondaryAddress = secondaryAddress;
        this.primaryPhone = primaryPhone;
        this.secondaryPhone = secondaryPhone;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getMiddleName() {
        return middleName;
    }

    public void setMiddleName(String middleName) {
        this.middleName = middleName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public Gender getGender() {
        return gender;
    }

    public void setGender(Gender gender) {
        this.gender = gender;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public LocalDate getGraduationDate() {
        return graduationDate;
    }

    public void setGraduationDate(LocalDate graduationDate) {
        this.graduationDate = graduationDate;
    }

    public String getPrimaryGuardianFirstName() {
        return primaryGuardianFirstName;
    }

    public void setPrimaryGuardianFirstName(String primaryGuardianFirstName) {
        this.primaryGuardianFirstName = primaryGuardianFirstName;
    }

    public String getPrimaryGuardianLastName() {
        return primaryGuardianLastName;
    }

    public void setPrimaryGuardianLastName(String primaryGuardianLastName) {
        this.primaryGuardianLastName = primaryGuardianLastName;
    }

    public String getSecondaryGuardianFirstName() {
        return secondaryGuardianFirstName;
    }

    public void setSecondaryGuardianFirstName(String secondaryGuardianFirstName) {
        this.secondaryGuardianFirstName = secondaryGuardianFirstName;
    }

    public String getSecondaryGuardianLastName() {
        return secondaryGuardianLastName;
    }

    public void setSecondaryGuardianLastName(String secondaryGuardianLastName) {
        this.secondaryGuardianLastName = secondaryGuardianLastName;
    }

    public String getPrimaryGuardianEmail() {
        return primaryGuardianEmail;
    }

    public void setPrimaryGuardianEmail(String primaryGuardianEmail) {
        this.primaryGuardianEmail = primaryGuardianEmail;
    }

    public String getSecondaryGuardianEmail() {
        return secondaryGuardianEmail;
    }

    public void setSecondaryGuardianEmail(String secondaryGuardianEmail) {
        this.secondaryGuardianEmail = secondaryGuardianEmail;
    }

    public String getPrimaryAddress() {
        return primaryAddress;
    }

    public void setPrimaryAddress(String primaryAddress) {
        this.primaryAddress = primaryAddress;
    }

    public String getSecondaryAddress() {
        return secondaryAddress;
    }

    public void setSecondaryAddress(String secondaryAddress) {
        this.secondaryAddress = secondaryAddress;
    }

    public String getPrimaryPhone() {
        return primaryPhone;
    }

    public void setPrimaryPhone(String primaryPhone) {
        this.primaryPhone = primaryPhone;
    }

    public String getSecondaryPhone() {
        return secondaryPhone;
    }

    public void setSecondaryPhone(String secondaryPhone) {
        this.secondaryPhone = secondaryPhone;
    }

    public String getFullName() {
        return middleName == null || middleName.isBlank()
                ? firstName + " " + lastName
                : firstName + " " + middleName + " " + lastName;
    }
}
