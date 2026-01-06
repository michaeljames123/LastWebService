import { useEffect, useState } from "react";

import { listScans } from "../api/api";
import { useAuth } from "../auth/AuthContext";
import Card from "../components/Card";
import type { Scan } from "../types";

export default function ProfilePage() {
  const auth = useAuth();
  const token = auth.token;

  const [scans, setScans] = useState<Scan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    listScans(token)
      .then(setScans)
      .catch((err: any) => setError(err?.message ?? "Failed to load scan history"));
  }, [token]);

  const user = auth.user;

  return (
    <div className="container" style={{ padding: "34px 0 54px" }}>
      <div className="grid grid-2">
        <div>
          <Card className="panel">
            <div className="h2">Profile</div>
            <div className="hr" />
            {user ? (
              <>
                <div className="small">Username: {user.username}</div>
                <div className="small" style={{ marginTop: 4 }}>
                  Email: {user.email}
                </div>
                {user.full_name ? (
                  <div className="small" style={{ marginTop: 4 }}>
                    Full name: {user.full_name}
                  </div>
                ) : null}
                <div className="small" style={{ marginTop: 4 }}>
                  Member since: {new Date(user.created_at).toLocaleString()}
                </div>
              </>
            ) : (
              <div className="small">No user loaded.</div>
            )}
          </Card>
        </div>

        <div>
          <Card className="panel">
            <div className="h2">Scan history</div>
            <div className="small" style={{ marginTop: 8 }}>
              All scans associated with your account.
            </div>

            <div className="hr" />

            {error ? <div className="notice bad">{error}</div> : null}

            {scans.length === 0 ? (
              <div className="small">No scans yet. Run a scan from the dashboard.</div>
            ) : (
              <div className="scan-list">
                {scans.map((s) => {
                  const detections = Array.isArray((s as any).result?.detections)
                    ? (s as any).result.detections.length
                    : 0;
                  const fieldHealth = (s as any).result?.field_health;
                  const fieldHealthPercent =
                    fieldHealth && typeof fieldHealth.field_health_percent === "number"
                      ? fieldHealth.field_health_percent
                      : null;

                  return (
                    <div className="scan-item" key={s.id}>
                      <div>
                        <div className="scan-title">Scan #{s.id}</div>
                        <div className="small">{new Date(s.created_at).toLocaleString()}</div>
                        <div className="small" style={{ marginTop: 4 }}>
                          Detections: {detections}
                        </div>
                        {fieldHealthPercent !== null ? (
                          <div className="small" style={{ marginTop: 2 }}>
                            Field health: {fieldHealthPercent}%
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
