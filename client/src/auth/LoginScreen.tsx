import { useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import { useAuth } from "./useAuth";

export default function LoginScreen() {
  const { login, loginPending } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      await login(email, password);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Login failed");
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Learning Management System</h1>
        <p>Powered by TryAngleTree</p>
        <br />
        <p>Sign in to continue</p>
      </header>

      <section className="section-card login-card">
        <h2>Sign In</h2>

        <form onSubmit={handleSubmit} className="form-grid">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />

          <button type="submit" disabled={loginPending}>
            {loginPending ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <ErrorMessage message={error} />

        <div className="login-hint">
          <p>
            <strong>Seeded accounts</strong>
          </p>
          <p>
            <code>admin@lms.local</code> / <code>admin123</code>
          </p>
          <p>
            <code>teacher@lms.local</code> / <code>teacher123</code>
          </p>
          <p>
            <code>student@lms.local</code> / <code>student123</code>
          </p>
        </div>
      </section>
    </main>
  );
}
