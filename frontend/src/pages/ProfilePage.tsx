import { useEffect, useState } from "react";

import { API_BASE_URL, listScans } from "../api/api";
import { useAuth } from "../auth/AuthContext";
import Card from "../components/Card";
import type { Scan } from "../types";

export default function ProfilePage() {
  const auth = useAuth();
  const token = auth.token;

  const [scans, setScans] = useState<Scan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanImages, setScanImages] = useState<Record<number, string | null>>({});

  useEffect(() => {
    if (!token) return;

    listScans(token)
      .then(setScans)
      .catch((err: any) => setError(err?.message ?? "Failed to load scan history"));
  }, [token]);

  useEffect(() => {
    if (!token || scans.length === 0) {
      setScanImages((prev) => {
        Object.values(prev).forEach((url) => {
          if (url) {
            window.URL.revokeObjectURL(url);
          }
        });
        return {};
      });
      return;
    }

    let cancelled = false;

    async function loadImages() {
      const next: Record<number, string | null> = {};

      for (const s of scans) {
        try {
          const res = await fetch(`${API_BASE_URL}${s.image_url}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!res.ok) {
            next[s.id] = null;
            continue;
          }

          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          next[s.id] = url;
        } catch {
          next[s.id] = null;
        }
      }

      if (cancelled) {
        Object.values(next).forEach((url) => {
          if (url) {
            window.URL.revokeObjectURL(url);
          }
        });
        return;
      }

      setScanImages((prev) => {
        Object.values(prev).forEach((url) => {
          if (url) {
            window.URL.revokeObjectURL(url);
          }
        });
        return next;
      });
    }

    loadImages();

    return () => {
      cancelled = true;
    };
  }, [token, scans]);

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
                  const rawResult = (s as any).result ?? {};
                  const scanType =
                    typeof rawResult.scan_type === "string" ? rawResult.scan_type : "dashboard";

                  const detectionsArray = Array.isArray(rawResult.detections)
                    ? rawResult.detections
                    : Array.isArray(rawResult.predictions)
                    ? rawResult.predictions
                    : [];
                  const detections = detectionsArray.length;

                  const fieldHealth = rawResult.field_health;
                  const fieldHealthPercent =
                    fieldHealth && typeof fieldHealth.field_health_percent === "number"
                      ? fieldHealth.field_health_percent
                      : null;

                  const yieldEstimate = rawResult.yield_estimate;
                  const overallYieldIndex =
                    yieldEstimate && typeof yieldEstimate.overall_yield_index === "number"
                      ? yieldEstimate.overall_yield_index
                      : null;

                  return (
                    <div className="scan-item" key={s.id}>
                      <div>
                        <div className="scan-title">Scan #{s.id}</div>
                        <div className="small">{new Date(s.created_at).toLocaleString()}</div>
                        <div className="small" style={{ marginTop: 2 }}>
                          Type: {scanType === "estimate_field" ? "Estimate Field" : "Dashboard scan"}
                        </div>
                        <div className="small" style={{ marginTop: 4 }}>
                          Detections: {detections}
                        </div>
                        {fieldHealthPercent !== null ? (
                          <div className="small" style={{ marginTop: 2 }}>
                            Field health: {fieldHealthPercent}%
                          </div>
                        ) : null}
                        {overallYieldIndex !== null ? (
                          <div className="small" style={{ marginTop: 2 }}>
                            Yield index: {overallYieldIndex}%
                          </div>
                        ) : null}
                      </div>

                      <div className="scan-main">
                        {scanImages[s.id] ? (
                          <img
                            src={scanImages[s.id] as string}
                            alt={`Scan ${s.id}`}
                          />
                        ) : (
                          <div className="small">Image preview not available.</div>
                        )}
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
