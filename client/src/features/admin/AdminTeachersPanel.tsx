import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import SuccessMessage from "../../components/SuccessMessage";
import {
  createTeacher,
  deleteTeacher,
  getTeachers,
  resetTeacherPassword,
  updateTeacher,
} from "../../api/teachers";
import type { Gender, Teacher } from "../../types";
import { getErrorMessage } from "../../utils/errors";
import { getTeacherFullName } from "../../utils/profile";
import { isNonEmpty } from "../../utils/validation";

type TeacherFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: Gender | "";
  dateOfBirth: string;
  email: string;
  primaryAddress: string;
  secondaryAddress: string;
  primaryPhone: string;
  secondaryPhone: string;
};

const EMPTY_TEACHER_FORM: TeacherFormState = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "",
  dateOfBirth: "",
  email: "",
  primaryAddress: "",
  secondaryAddress: "",
  primaryPhone: "",
  secondaryPhone: "",
};

export default function AdminTeachersPanel() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [createForm, setCreateForm] = useState<TeacherFormState>(EMPTY_TEACHER_FORM);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [editForm, setEditForm] = useState<TeacherFormState>(EMPTY_TEACHER_FORM);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isCreateValid =
    hasRequiredTeacherFields(createForm) && isNonEmpty(temporaryPassword);
  const isEditValid = hasRequiredTeacherFields(editForm);
  const isResetValid =
    isNonEmpty(resetPassword) && isNonEmpty(resetConfirmPassword);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const data = await getTeachers();
        if (!isCancelled) {
          setTeachers(data);
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

  const selectedTeacher = useMemo(() => {
    return teachers.find((teacher) => teacher.id === selectedTeacherId) ?? null;
  }, [teachers, selectedTeacherId]);

  async function refreshTeachers() {
    try {
      const data = await getTeachers();
      setTeachers(data);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    }
  }

  async function handleCreateTeacher(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isCreateValid) {
      return;
    }

    try {
      const createdTeacher = await createTeacher({
        ...toTeacherPayload(createForm),
        temporaryPassword: temporaryPassword.trim(),
      });

      setCreateForm(EMPTY_TEACHER_FORM);
      setTemporaryPassword("");
      setSuccessMessage("Teacher created successfully.");

      await refreshTeachers();
      setSelectedTeacherId(createdTeacher.id);
      setIsEditing(false);
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    }
  }

  async function handleUpdateTeacher() {
    if (!selectedTeacher || !isEditValid) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      await updateTeacher(selectedTeacher.id, toTeacherPayload(editForm));
      setSuccessMessage("Teacher updated successfully.");
      setIsEditing(false);
      await refreshTeachers();
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    }
  }

  async function handleDeleteTeacher() {
    if (!selectedTeacher) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      await deleteTeacher(selectedTeacher.id);
      setSuccessMessage("Teacher deleted successfully.");
      setSelectedTeacherId("");
      setIsEditing(false);
      await refreshTeachers();
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    }
  }

  async function handleResetPassword() {
    if (!selectedTeacher || !isResetValid) {
      return;
    }

    setError("");
    setSuccessMessage("");

    if (resetPassword !== resetConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const response = await resetTeacherPassword(selectedTeacher.id, {
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
    if (!selectedTeacher) {
      return;
    }

    setEditForm(fromTeacher(selectedTeacher));
    setIsEditing(true);
    setError("");
    setSuccessMessage("");
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditForm(EMPTY_TEACHER_FORM);
  }

  return (
    <div>
      <h4>Teachers</h4>
      <p className="meta-text">Create, inspect, edit, and remove structured teacher profiles.</p>

      <form onSubmit={handleCreateTeacher} className="form-grid" style={{ marginTop: 16 }}>
        <TeacherFormFields
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
          Add Teacher
        </button>
      </form>

      <ErrorMessage message={error} />
      <SuccessMessage message={successMessage} />

      <div className="split-panel" style={{ marginTop: 20 }}>
        <div>
          <h4>Select Existing Teacher</h4>

          {teachers.length === 0 ? (
            <EmptyState message="No teachers found." />
          ) : (
            <div className="form-grid">
              <select
                value={selectedTeacherId}
                onChange={(event) => {
                  setSelectedTeacherId(event.target.value);
                  setIsEditing(false);
                }}
              >
                <option value="">Select teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {getTeacherFullName(teacher)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <h4>Teacher Details</h4>

          {!selectedTeacher ? (
            <EmptyState message="Select a teacher to view details." />
          ) : isEditing ? (
            <div className="section-card" style={{ marginTop: 12 }}>
              <TeacherFormFields
                form={editForm}
                onChange={(field, value) =>
                  setEditForm((current) => ({ ...current, [field]: value }))
                }
              />

              <div className="inline-actions" style={{ marginTop: 16 }}>
                <button type="button" onClick={handleUpdateTeacher} disabled={!isEditValid}>
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
                <strong>Name:</strong> {getTeacherFullName(selectedTeacher)}
              </p>
              <p className="meta-text">
                <strong>Email:</strong> {selectedTeacher.email}
              </p>
              <p className="meta-text">
                <strong>Gender:</strong> {selectedTeacher.gender}
              </p>
              <p className="meta-text">
                <strong>Date of Birth:</strong> {selectedTeacher.dateOfBirth}
              </p>

              <div className="inline-actions" style={{ marginTop: 16 }}>
                <button type="button" onClick={beginEdit}>
                  Edit Teacher
                </button>
                <button type="button" className="danger-button" onClick={handleDeleteTeacher}>
                  Delete Teacher
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

function TeacherFormFields({
  form,
  onChange,
}: {
  form: TeacherFormState;
  onChange: (field: keyof TeacherFormState, value: string) => void;
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
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) => onChange("email", event.target.value)}
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

function hasRequiredTeacherFields(form: TeacherFormState) {
  return (
    isNonEmpty(form.firstName) &&
    isNonEmpty(form.lastName) &&
    isNonEmpty(form.gender) &&
    isNonEmpty(form.dateOfBirth) &&
    isNonEmpty(form.email)
  );
}

function toTeacherPayload(form: TeacherFormState) {
  return {
    firstName: form.firstName.trim(),
    middleName: optionalValue(form.middleName),
    lastName: form.lastName.trim(),
    gender: form.gender as Gender,
    dateOfBirth: form.dateOfBirth,
    email: form.email.trim(),
    primaryAddress: optionalValue(form.primaryAddress),
    secondaryAddress: optionalValue(form.secondaryAddress),
    primaryPhone: optionalValue(form.primaryPhone),
    secondaryPhone: optionalValue(form.secondaryPhone),
  };
}

function fromTeacher(teacher: Teacher): TeacherFormState {
  return {
    firstName: teacher.firstName,
    middleName: teacher.middleName ?? "",
    lastName: teacher.lastName,
    gender: teacher.gender,
    dateOfBirth: teacher.dateOfBirth,
    email: teacher.email,
    primaryAddress: teacher.primaryAddress ?? "",
    secondaryAddress: teacher.secondaryAddress ?? "",
    primaryPhone: teacher.primaryPhone ?? "",
    secondaryPhone: teacher.secondaryPhone ?? "",
  };
}

function optionalValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
