import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import {
  createTeacher,
  deleteTeacher,
  getTeachers,
} from "../../api/teachers";
import type { Gender, Teacher } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { getTeacherFullName } from "../../utils/profile";
import { isNonEmpty } from "../../utils/validation";
import { useDataRefresh } from "../../data/useDataRefresh";

export default function TeacherSection() {
  const { versions, refresh } = useDataRefresh();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isFormValid =
    isNonEmpty(firstName) &&
    isNonEmpty(lastName) &&
    isNonEmpty(gender) &&
    isNonEmpty(dateOfBirth) &&
    isNonEmpty(email) &&
    isNonEmpty(temporaryPassword);

  useEffect(() => {
    getTeachers()
      .then((data) => {
        setTeachers(data);
      })
      .catch((error: unknown) => {
        setError(getErrorMessage(error));
      });
  }, [versions.teachers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isFormValid) {
      return;
    }

    try {
      await createTeacher({
        firstName: firstName.trim(),
        middleName: null,
        lastName: lastName.trim(),
        gender: gender as Gender,
        dateOfBirth,
        email: email.trim(),
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
      setEmail("");
      setTemporaryPassword("");
      setSuccessMessage("Teacher created successfully.");
      refresh("teachers");
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  async function handleDelete(teacherId: string) {
    setError("");
    setSuccessMessage("");

    try {
      await deleteTeacher(teacherId);
      setSuccessMessage("Teacher deleted successfully.");
      refresh("teachers");
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  return (
    <SectionCard title="Teachers">
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Teacher email"
        />
        <input
          type="password"
          value={temporaryPassword}
          onChange={(e) => setTemporaryPassword(e.target.value)}
          placeholder="Temporary password"
        />
        <button type="submit" disabled={!isFormValid}>
          Create Teacher
        </button>
      </form>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <ul className="data-list">
        {teachers.map((teacher) => (
          <li key={teacher.id}>
            <strong>{getTeacherFullName(teacher)}</strong> — {teacher.email}
            <div className="inline-actions">
              <button
                type="button"
                className="danger-button"
                onClick={() => handleDelete(teacher.id)}
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
