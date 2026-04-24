import { useEffect, useMemo, useState } from "react";
import { getStudents } from "../api/students";
import { getTeachers } from "../api/teachers";
import { useAuth } from "./useAuth";
import ErrorMessage from "../components/ErrorMessage";
import type { Student, Teacher, UserRole } from "../types";
import { getErrorMessage } from "../utils/errors";
import { getStudentFullName, getTeacherFullName } from "../utils/profile";

type ViewAsRole = Exclude<UserRole, "ADMIN">;

type ViewAsOption = {
  id: string;
  label: string;
};

type Props = {
  isOpen: boolean;
  realRole: UserRole;
  onClose: () => void;
};

export default function ViewAsModal({ isOpen, realRole, onClose }: Props) {
  const { startViewAs } = useAuth();
  const [selectedRole, setSelectedRole] = useState<ViewAsRole | "">("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [options, setOptions] = useState<ViewAsOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const roleOptions = useMemo<ViewAsRole[]>(() => {
    if (realRole === "ADMIN") {
      return ["TEACHER", "STUDENT"];
    }

    if (realRole === "TEACHER") {
      return ["STUDENT"];
    }

    return [];
  }, [realRole]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedRole("");
      setSelectedUserId("");
      setOptions([]);
      setLoadingOptions(false);
      setSubmitting(false);
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedRole) {
      setOptions([]);
      setSelectedUserId("");
      return;
    }

    let isCancelled = false;

    void (async () => {
      setLoadingOptions(true);
      setError("");
      setSelectedUserId("");

      try {
        if (selectedRole === "TEACHER") {
          const teachers = await getTeachers();
          if (!isCancelled) {
            setOptions(mapTeacherOptions(teachers));
          }
          return;
        }

        const students = await getStudents();
        if (!isCancelled) {
          setOptions(mapStudentOptions(students));
        }
      } catch (loadError: unknown) {
        if (!isCancelled) {
          setOptions([]);
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!isCancelled) {
          setLoadingOptions(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, selectedRole]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedRole || !selectedUserId) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await startViewAs({
        role: selectedRole,
        linkedEntityId: selectedUserId,
      });
      onClose();
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-as-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="view-as-title">View As</h2>
        <p className="modal-copy">
          Switch your effective role and dashboard without signing out.
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>Role</span>
            <select
              value={selectedRole}
              onChange={(event) =>
                setSelectedRole(event.target.value as ViewAsRole | "")
              }
            >
              <option value="">Select role</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="modal-field">
            <span>User</span>
            <select
              value={selectedUserId}
              disabled={!selectedRole || loadingOptions}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              <option value="">
                {!selectedRole
                  ? "Select role first"
                  : loadingOptions
                    ? "Loading users..."
                    : `Select ${selectedRole.toLowerCase()}`}
              </option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <ErrorMessage message={error} />

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedRole || !selectedUserId || submitting}
            >
              {submitting ? "Switching..." : "OK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function mapTeacherOptions(teachers: Teacher[]): ViewAsOption[] {
  return teachers.map((teacher) => ({
    id: teacher.id,
    label: getTeacherFullName(teacher),
  }));
}

function mapStudentOptions(students: Student[]): ViewAsOption[] {
  return students.map((student) => ({
    id: student.id,
    label: getStudentFullName(student),
  }));
}
