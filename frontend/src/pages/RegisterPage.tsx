import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Button from "../components/Button";
import Card from "../components/Card";
import { useAuth } from "../auth/AuthContext";

export default function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await auth.register({
        email,
        username,
        full_name: fullName || undefined,
        password,
      });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Registration failed");
    }
  }

  return (
    <div className="container" style={{ padding: "34px 0 54px" }}>
      <div className="auth-grid">
        <div>
          <div className="badge">
            <span className="badge-dot ok" /> New season, new insights
          </div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Create your AgridroneScan account
          </h1>
          <p className="p" style={{ marginTop: 14 }}>
            Your account stores scan results and lets you build an AI-powered history of your fields.
          </p>
        </div>

        <Card className="form-card">
          <form onSubmit={onSubmit} className="form">
            <label className="field">
              <span className="field-label">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@farm.com"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Username</span>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="farm_manager"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Full name (optional)</span>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Dela Cruz"
              />
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </label>

            {error ? <div className="notice bad">{error}</div> : null}

            <div className="form-actions">
              <Button type="submit" disabled={auth.loading}>
                {auth.loading ? "Creating…" : "Create account"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate("/")}> 
                Back
              </Button>
            </div>

            <div className="small" style={{ marginTop: 10 }}>
              Already have an account? <Link className="link" to="/login">Sign in</Link>.
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
