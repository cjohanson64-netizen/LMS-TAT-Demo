import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import {
  createStudent,
  deleteStudent,
  getStudents,
} from "../../api/students";
import type { Gender, Student } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { getStudentFullName } from "../../utils/profile";
import { isNonEmpty } from "../../utils/validation";
import { useDataRefresh } from "../../data/useDataRefresh";

export default function StudentSection() {
  const { versions, refresh } = useDataRefresh();
  const [students, setStudents] = useState<Student[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const [email, setEmail] = useState("");
  const [primaryGuardianFirstName, setPrimaryGuardianFirstName] = useState("");
  const [primaryGuardianLastName, setPrimaryGuardianLastName] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isFormValid =
    isNonEmpty(firstName) &&
    isNonEmpty(lastName) &&
    isNonEmpty(gender) &&
    isNonEmpty(dateOfBirth) &&
    isNonEmpty(graduationDate) &&
    isNonEmpty(email) &&
    isNonEmpty(primaryGuardianFirstName) &&
    isNonEmpty(primaryGuardianLastName) &&
    isNonEmpty(temporaryPassword);

  useEffect(() => {
    getStudents()
      .then((data) => {
        setStudents(data);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [versions.students]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isFormValid) {
      return;
    }

    try {
      await createStudent({
        firstName: firstName.trim(),
        middleName: null,
        lastName: lastName.trim(),
        gender: gender as Gender,
        dateOfBirth,
        graduationDate,
        email: email.trim(),
        primaryGuardianFirstName: primaryGuardianFirstName.trim(),
        primaryGuardianLastName: primaryGuardianLastName.trim(),
        secondaryGuardianFirstName: null,
        secondaryGuardianLastName: null,
        primaryGuardianEmail: null,
        secondaryGuardianEmail: null,
        primaryAddress: null,
        secondaryAddress: null,
        primaryPhone: null,
        secondaryPhone: null,
        temporaryPassword: temporaryPassword.trim(),
      });

      setFirstName("");
      setLastName("");
      setGender("");
      setDateOfBirth("");
      setGraduationDate("");
      setEmail("");
      setPrimaryGuardianFirstName("");
      setPrimaryGuardianLastName("");
      setTemporaryPassword("");
      setSuccessMessage("Student created successfully.");
      refresh("students");
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  async function handleDelete(studentId: string) {
    setError("");
    setSuccessMessage("");

    try {
      await deleteStudent(studentId);
      setSuccessMessage("Student deleted successfully.");
      refresh("students");
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  return (
    <SectionCard title="Students">
      <form onSubmit={handleSubmit} className="form-grid">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
        />
        <select value={gender} onChange={(e) => setGender(e.target.value as Gender | "")}>
          <option value="">Select gender</option>
          <option value="MALE">MALE</option>
          <option value="FEMALE">FEMALE</option>
          <option value="OTHER">OTHER</option>
        </select>
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
        />
        <input
          type="date"
          value={graduationDate}
          onChange={(e) => setGraduationDate(e.target.value)}
        />
        <input
          value={primaryGuardianFirstName}
          onChange={(e) => setPrimaryGuardianFirstName(e.target.value)}
          placeholder="Primary guardian first name"
        />
        <input
          value={primaryGuardianLastName}
          onChange={(e) => setPrimaryGuardianLastName(e.target.value)}
          placeholder="Primary guardian last name"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Student email"
        />
        <input
          type="password"
          value={temporaryPassword}
          onChange={(e) => setTemporaryPassword(e.target.value)}
          placeholder="Temporary password"
        />
        <button type="submit" disabled={!isFormValid}>
          Create Student
        </button>
      </form>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <ul className="data-list">
        {students.map((student) => (
          <li key={student.id}>
            <strong>{getStudentFullName(student)}</strong> — {student.email}
            <div className="inline-actions">
              <button
                type="button"
                className="danger-button"
                onClick={() => handleDelete(student.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
