import { useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import { useAuth } from "./useAuth";
import { getErrorMessage } from "../utils/errors";

export default function ImpersonationBanner() {
  const { effectiveDisplayName, email, stopViewAs } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");

  async function handleLeaveView() {
    setLeaving(true);
    setError("");

    try {
      await stopViewAs();
    } catch (leaveError: unknown) {
      setError(getErrorMessage(leaveError));
    } finally {
      setLeaving(false);
    }
  }

  return (
    <section className="impersonation-banner">
      <div>
        <strong>Viewing as: {effectiveDisplayName ?? "Unknown user"}</strong>
        <p>Signed in as: {email ?? "Unknown user"}</p>
      </div>

      <button
        type="button"
        className="secondary-button"
        onClick={() => void handleLeaveView()}
        disabled={leaving}
      >
        {leaving ? "Leaving..." : "Leave View"}
      </button>

      <ErrorMessage message={error} />
    </section>
  );
}
