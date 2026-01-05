import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <div className="container" style={{ padding: "34px 0" }}>
        <div className="surface" style={{ padding: 18 }}>
          <div className="h2">Loading…</div>
          <p className="p" style={{ marginTop: 8 }}>
            Preparing your dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (!auth.token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
