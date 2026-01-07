import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Button from "../components/Button";
import Card from "../components/Card";
import { useAuth } from "../auth/AuthContext";

export default function AdminLoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from ?? "/admin";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await auth.login(identifier, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Admin login failed");
    }
  }

  return (
    <div className="container" style={{ padding: "34px 0 54px" }}>
      <div className="auth-grid">
        <div>
          <div className="badge">
            <span className="badge-dot ok" /> Admin access
          </div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Sign in to admin control panel
          </h1>
          <p className="p" style={{ marginTop: 14 }}>
            Use an email that has been granted admin privileges to manage users and scans.
          </p>
        </div>

        <Card className="form-card">
          <form onSubmit={onSubmit} className="form">
            <label className="field">
              <span className="field-label">Admin email or username</span>
              <input
                className="input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@farm.com"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error ? <div className="notice bad">{error}</div> : null}

            <div className="form-actions">
              <Button type="submit" disabled={auth.loading}>
                {auth.loading ? "Signing in…" : "Admin Login"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate("/")}>
                Back
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
