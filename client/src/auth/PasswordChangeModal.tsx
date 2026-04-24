import { useEffect, useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import { useAuth } from "./useAuth";
import { getErrorMessage } from "../utils/errors";

type Props = {
  isOpen: boolean;
  forced: boolean;
  onClose: () => void;
  onForcedCancel: () => Promise<void>;
};

export default function PasswordChangeModal({
  isOpen,
  forced,
  onClose,
  onForcedCancel,
}: Props) {
  const { changePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setConfirmPassword("");
      setError("");
      setSubmitting(false);
    }
  }, [isOpen]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      await changePassword({ password, confirmPassword });
      onClose();
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setError("");

    if (forced) {
      setSubmitting(true);

      try {
        await onForcedCancel();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    onClose();
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={forced ? undefined : onClose}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-change-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="password-change-title">
          {forced ? "Set Your Password" : "Change Password"}
        </h2>
        <p className="modal-copy">
          {forced
            ? "You need to set a new password before continuing."
            : "Choose a new password for your account."}
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>

          <label className="modal-field">
            <span>Confirm Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>

          <ErrorMessage message={error} />

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleCancel()}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password || !confirmPassword || submitting}
            >
              {submitting ? "Saving..." : "OK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
