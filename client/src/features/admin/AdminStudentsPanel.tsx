import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import {
  createStudent,
  deleteStudent,
  getStudents,
  resetStudentPassword,
  updateStudent,
} from "../../api/students";
import type { Gender, Student } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { getStudentFullName } from "../../utils/profile";
import { isNonEmpty } from "../../utils/validation";

type StudentFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: Gender | "";
  dateOfBirth: string;
  graduationDate: string;
  email: string;
  primaryGuardianFirstName: string;
  primaryGuardianLastName: string;
  secondaryGuardianFirstName: string;
  secondaryGuardianLastName: string;
  primaryGuardianEmail: string;
  secondaryGuardianEmail: string;
  primaryAddress: string;
  secondaryAddress: string;
  primaryPhone: string;
  secondaryPhone: string;
};

const EMPTY_STUDENT_FORM: StudentFormState = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "",
  dateOfBirth: "",
  graduationDate: "",
  email: "",
  primaryGuardianFirstName: "",
  primaryGuardianLastName: "",
  secondaryGuardianFirstName: "",
  secondaryGuardianLastName: "",
  primaryGuardianEmail: "",
  secondaryGuardianEmail: "",
  primaryAddress: "",
  secondaryAddress: "",
  primaryPhone: "",
  secondaryPhone: "",
};

export default function AdminStudentsPanel() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [createForm, setCreateForm] = useState<StudentFormState>(EMPTY_STUDENT_FORM);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [editForm, setEditForm] = useState<StudentFormState>(EMPTY_STUDENT_FORM);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isCreateValid =
    hasRequiredStudentFields(createForm) && isNonEmpty(temporaryPassword);
  const isEditValid = hasRequiredStudentFields(editForm);
  const isResetValid =
    isNonEmpty(resetPassword) && isNonEmpty(resetConfirmPassword);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const data = await getStudents();
        if (!isCancelled) {
          setStudents(data);
        }
      } catch (loadError: unknown) {
        if (!isCancelled) {
          setError(getErrorMessage(loadError));
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const selectedStudent = useMemo(() => {
    return students.find((student) => student.id === selectedStudentId) ?? null;
  }, [students, selectedStudentId]);

  async function refreshStudents() {
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    }
  }

  async function handleCreateStudent(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isCreateValid) {
      return;
    }

    try {
      const createdStudent = await createStudent({
        ...toStudentPayload(createForm),
        temporaryPassword: temporaryPassword.trim(),
      });

      setCreateForm(EMPTY_STUDENT_FORM);
      setTemporaryPassword("");
      setSuccessMessage("Student created successfully.");

      await refreshStudents();
      setSelectedStudentId(createdStudent.id);
      setIsEditing(false);
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    }
  }

  async function handleUpdateStudent() {
    if (!selectedStudent || !isEditValid) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      await updateStudent(selectedStudent.id, toStudentPayload(editForm));
      setSuccessMessage("Student updated successfully.");
      setIsEditing(false);
      await refreshStudents();
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    }
  }

  async function handleDeleteStudent() {
    if (!selectedStudent) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      await deleteStudent(selectedStudent.id);
      setSuccessMessage("Student deleted successfully.");
      setSelectedStudentId("");
      setIsEditing(false);
      await refreshStudents();
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    }
  }

  async function handleResetPassword() {
    if (!selectedStudent || !isResetValid) {
      return;
    }

    setError("");
    setSuccessMessage("");

    if (resetPassword !== resetConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const response = await resetStudentPassword(selectedStudent.id, {
        password: resetPassword,
        confirmPassword: resetConfirmPassword,
      });
      setResetPassword("");
      setResetConfirmPassword("");
      setSuccessMessage(response.message);
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    }
  }

  function beginEdit() {
    if (!selectedStudent) {
      return;
    }

    setEditForm(fromStudent(selectedStudent));
    setIsEditing(true);
    setError("");
    setSuccessMessage("");
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditForm(EMPTY_STUDENT_FORM);
  }

  return (
    <div>
      <h4>Students</h4>
      <p className="meta-text">Create, inspect, edit, and remove structured student profiles.</p>

      <form onSubmit={handleCreateStudent} className="form-grid" style={{ marginTop: 16 }}>
        <StudentFormFields
          form={createForm}
          onChange={(field, value) =>
            setCreateForm((current) => ({ ...current, [field]: value }))
          }
        />

        <div className="section-card" style={{ marginBottom: 0 }}>
          <h4>Credentials</h4>
          <div className="form-grid">
            <input
              type="password"
              placeholder="Temporary password"
              value={temporaryPassword}
              onChange={(event) => setTemporaryPassword(event.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={!isCreateValid}>
          Add Student
        </button>
      </form>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <div className="split-panel" style={{ marginTop: 20 }}>
        <div>
          <h4>Select Existing Student</h4>

          {students.length === 0 ? (
            <EmptyState message="No students found." />
          ) : (
            <div className="form-grid">
              <select
                value={selectedStudentId}
                onChange={(event) => {
                  setSelectedStudentId(event.target.value);
                  setIsEditing(false);
                }}
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {getStudentFullName(student)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <h4>Student Details</h4>

          {!selectedStudent ? (
            <EmptyState message="Select a student to view details." />
          ) : isEditing ? (
            <div className="section-card" style={{ marginTop: 12 }}>
              <StudentFormFields
                form={editForm}
                onChange={(field, value) =>
                  setEditForm((current) => ({ ...current, [field]: value }))
                }
              />

              <div className="inline-actions" style={{ marginTop: 16 }}>
                <button type="button" onClick={handleUpdateStudent} disabled={!isEditValid}>
                  Save Changes
                </button>
                <button type="button" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="section-card" style={{ marginTop: 12 }}>
              <p className="meta-text">
                <strong>Name:</strong> {getStudentFullName(selectedStudent)}
              </p>
              <p className="meta-text">
                <strong>Email:</strong> {selectedStudent.email}
              </p>
              <p className="meta-text">
                <strong>Gender:</strong> {selectedStudent.gender}
              </p>
              <p className="meta-text">
                <strong>Date of Birth:</strong> {selectedStudent.dateOfBirth}
              </p>
              <p className="meta-text">
                <strong>Graduation Date:</strong> {selectedStudent.graduationDate}
              </p>
              <p className="meta-text">
                <strong>Primary Guardian:</strong>{" "}
                {selectedStudent.primaryGuardianFirstName} {selectedStudent.primaryGuardianLastName}
              </p>

              <div className="inline-actions" style={{ marginTop: 16 }}>
                <button type="button" onClick={beginEdit}>
                  Edit Student
                </button>
                <button type="button" className="danger-button" onClick={handleDeleteStudent}>
                  Delete Student
                </button>
              </div>

              <div className="section-card" style={{ marginTop: 20, marginBottom: 0 }}>
                <h4>Reset Password</h4>
                <div className="form-grid">
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    placeholder="Temporary password"
                  />
                  <input
                    type="password"
                    value={resetConfirmPassword}
                    onChange={(event) => setResetConfirmPassword(event.target.value)}
                    placeholder="Confirm temporary password"
                  />
                  <button type="button" onClick={handleResetPassword} disabled={!isResetValid}>
                    Reset Password
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentFormFields({
  form,
  onChange,
}: {
  form: StudentFormState;
  onChange: (field: keyof StudentFormState, value: string) => void;
}) {
  return (
    <>
      <div className="section-card" style={{ marginBottom: 0 }}>
        <h4>Personal Info</h4>
        <div className="form-grid">
          <input
            type="text"
            placeholder="First name"
            value={form.firstName}
            onChange={(event) => onChange("firstName", event.target.value)}
          />
          <input
            type="text"
            placeholder="Middle name"
            value={form.middleName}
            onChange={(event) => onChange("middleName", event.target.value)}
          />
          <input
            type="text"
            placeholder="Last name"
            value={form.lastName}
            onChange={(event) => onChange("lastName", event.target.value)}
          />
          <select
            value={form.gender}
            onChange={(event) => onChange("gender", event.target.value)}
          >
            <option value="">Select gender</option>
            <option value="MALE">MALE</option>
            <option value="FEMALE">FEMALE</option>
            <option value="OTHER">OTHER</option>
          </select>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(event) => onChange("dateOfBirth", event.target.value)}
          />
          <input
            type="date"
            value={form.graduationDate}
            onChange={(event) => onChange("graduationDate", event.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) => onChange("email", event.target.value)}
          />
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: 0 }}>
        <h4>Guardian Info</h4>
        <div className="form-grid">
          <input
            type="text"
            placeholder="Primary guardian first name"
            value={form.primaryGuardianFirstName}
            onChange={(event) =>
              onChange("primaryGuardianFirstName", event.target.value)
            }
          />
          <input
            type="text"
            placeholder="Primary guardian last name"
            value={form.primaryGuardianLastName}
            onChange={(event) =>
              onChange("primaryGuardianLastName", event.target.value)
            }
          />
          <input
            type="text"
            placeholder="Secondary guardian first name"
            value={form.secondaryGuardianFirstName}
            onChange={(event) =>
              onChange("secondaryGuardianFirstName", event.target.value)
            }
          />
          <input
            type="text"
            placeholder="Secondary guardian last name"
            value={form.secondaryGuardianLastName}
            onChange={(event) =>
              onChange("secondaryGuardianLastName", event.target.value)
            }
          />
          <input
            type="email"
            placeholder="Primary guardian email"
            value={form.primaryGuardianEmail}
            onChange={(event) =>
              onChange("primaryGuardianEmail", event.target.value)
            }
          />
          <input
            type="email"
            placeholder="Secondary guardian email"
            value={form.secondaryGuardianEmail}
            onChange={(event) =>
              onChange("secondaryGuardianEmail", event.target.value)
            }
          />
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: 0 }}>
        <h4>Contact Info</h4>
        <div className="form-grid">
          <input
            type="text"
            placeholder="Primary address"
            value={form.primaryAddress}
            onChange={(event) => onChange("primaryAddress", event.target.value)}
          />
          <input
            type="text"
            placeholder="Secondary address"
            value={form.secondaryAddress}
            onChange={(event) => onChange("secondaryAddress", event.target.value)}
          />
          <input
            type="text"
            placeholder="Primary phone"
            value={form.primaryPhone}
            onChange={(event) => onChange("primaryPhone", event.target.value)}
          />
          <input
            type="text"
            placeholder="Secondary phone"
            value={form.secondaryPhone}
            onChange={(event) => onChange("secondaryPhone", event.target.value)}
          />
        </div>
      </div>
    </>
  );
}

function hasRequiredStudentFields(form: StudentFormState) {
  return (
    isNonEmpty(form.firstName) &&
    isNonEmpty(form.lastName) &&
    isNonEmpty(form.gender) &&
    isNonEmpty(form.dateOfBirth) &&
    isNonEmpty(form.graduationDate) &&
    isNonEmpty(form.email) &&
    isNonEmpty(form.primaryGuardianFirstName) &&
    isNonEmpty(form.primaryGuardianLastName)
  );
}

function toStudentPayload(form: StudentFormState) {
  return {
    firstName: form.firstName.trim(),
    middleName: optionalValue(form.middleName),
    lastName: form.lastName.trim(),
    gender: form.gender as Gender,
    dateOfBirth: form.dateOfBirth,
    graduationDate: form.graduationDate,
    email: form.email.trim(),
    primaryGuardianFirstName: form.primaryGuardianFirstName.trim(),
    primaryGuardianLastName: form.primaryGuardianLastName.trim(),
    secondaryGuardianFirstName: optionalValue(form.secondaryGuardianFirstName),
    secondaryGuardianLastName: optionalValue(form.secondaryGuardianLastName),
    primaryGuardianEmail: optionalValue(form.primaryGuardianEmail),
    secondaryGuardianEmail: optionalValue(form.secondaryGuardianEmail),
    primaryAddress: optionalValue(form.primaryAddress),
    secondaryAddress: optionalValue(form.secondaryAddress),
    primaryPhone: optionalValue(form.primaryPhone),
    secondaryPhone: optionalValue(form.secondaryPhone),
  };
}

function fromStudent(student: Student): StudentFormState {
  return {
    firstName: student.firstName,
    middleName: student.middleName ?? "",
    lastName: student.lastName,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth,
    graduationDate: student.graduationDate,
    email: student.email,
    primaryGuardianFirstName: student.primaryGuardianFirstName,
    primaryGuardianLastName: student.primaryGuardianLastName,
    secondaryGuardianFirstName: student.secondaryGuardianFirstName ?? "",
    secondaryGuardianLastName: student.secondaryGuardianLastName ?? "",
    primaryGuardianEmail: student.primaryGuardianEmail ?? "",
    secondaryGuardianEmail: student.secondaryGuardianEmail ?? "",
    primaryAddress: student.primaryAddress ?? "",
    secondaryAddress: student.secondaryAddress ?? "",
    primaryPhone: student.primaryPhone ?? "",
    secondaryPhone: student.secondaryPhone ?? "",
  };
}

function optionalValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
