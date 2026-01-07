import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <div className="container" style={{ padding: "34px 0" }}>
        <div className="surface" style={{ padding: 18 }}>
          <div className="h2">Loading…</div>
          <p className="p" style={{ marginTop: 8 }}>
            Preparing your admin dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (!auth.token) {
    return <Navigate to="/adminlogin" replace state={{ from: location.pathname }} />;
  }

  if (!auth.user || !(auth.user as any).is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
