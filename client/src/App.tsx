import { useState } from "react";
import "./styles/App.css";
import LoginScreen from "./auth/LoginScreen";
import { useAuth } from "./auth/useAuth";
import TeacherDashboard from "./features/teacher/TeacherDashboard";
import StudentDashboard from "./features/student/StudentDashboard";
import AdminDashboard from "./features/admin/AdminDashboard";
import ViewAsModal from "./auth/ViewAsModal";
import ImpersonationBanner from "./auth/ImpersonationBanner";
import PasswordChangeModal from "./auth/PasswordChangeModal";
import ErrorMessage from "./components/ErrorMessage";
import { getErrorMessage } from "./utils/errors";

export default function App() {
  const {
    authUser,
    loading,
    logout,
    role,
    userId,
    realRole,
    isImpersonating,
    stopViewAs,
  } = useAuth();
  const [isViewAsOpen, setIsViewAsOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [headerError, setHeaderError] = useState("");

  const mustChangePassword = authUser?.mustChangePassword ?? false;
  const canUseViewAs =
    !isImpersonating && (realRole === "ADMIN" || realRole === "TEACHER");

  async function handleLeaveView() {
    setHeaderError("");

    try {
      await stopViewAs();
    } catch (error: unknown) {
      setHeaderError(getErrorMessage(error));
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <header className="app-header">
          <h1>Learning Management System</h1>
          <p>Powered by TryAngleTree</p>
          <br />
          <p>Loading session...</p>
        </header>
      </main>
    );
  }

  if (!authUser) {
    return <LoginScreen />;
  }

  const isPasswordModalVisible = mustChangePassword || isPasswordModalOpen;

  return (
    <main className="app-shell">
      <header className="app-header app-header-row">
        <div>
          <h1>Learning Management System</h1>
          <p>Powered by TryAngleTree</p>
          <br />
          <p>
            Signed in as {authUser.email}
            {realRole && role && realRole !== role ? ` · Viewing ${role}` : ""}
          </p>
        </div>

        <div className="app-header-actions">
          {canUseViewAs ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setIsViewAsOpen(true)}
            >
              View As
            </button>
          ) : null}

          {isImpersonating ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleLeaveView()}
            >
              Leave View
            </button>
          ) : null}

          <button
            type="button"
            className="secondary-button"
            onClick={() => setIsPasswordModalOpen(true)}
          >
            Change Password
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void logout()}
          >
            Sign Out
          </button>
        </div>
      </header>

      <ErrorMessage message={headerError} />

      {isImpersonating ? <ImpersonationBanner /> : null}

      {!mustChangePassword && role === "ADMIN" && (
        <AdminDashboard key={`admin-dashboard-${role}-${userId}`} />
      )}

      {!mustChangePassword && role === "TEACHER" && (
        <TeacherDashboard key={`teacher-dashboard-${role}-${userId}`} />
      )}

      {!mustChangePassword && role === "STUDENT" && (
        <StudentDashboard key={`student-dashboard-${role}-${userId}`} />
      )}

      {realRole === "ADMIN" || realRole === "TEACHER" ? (
        <ViewAsModal
          isOpen={isViewAsOpen}
          realRole={realRole}
          onClose={() => setIsViewAsOpen(false)}
        />
      ) : null}

      <PasswordChangeModal
        isOpen={isPasswordModalVisible}
        forced={mustChangePassword}
        onClose={() => setIsPasswordModalOpen(false)}
        onForcedCancel={async () => {
          setIsPasswordModalOpen(false);
          setHeaderError("");
          await logout();
        }}
      />
    </main>
  );
}
