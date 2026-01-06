import React, { useEffect, useMemo, useState } from "react";

import { API_BASE_URL, createScan, getAiStatus, listScans } from "../api/api";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import Card from "../components/Card";
import type { AiStatus, Scan } from "../types";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function DashboardPage() {
  const auth = useAuth();

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [droneName, setDroneName] = useState("");
  const [flightDuration, setFlightDuration] = useState("");
  const [droneAltitude, setDroneAltitude] = useState("");
  const [location, setLocation] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [scanImages, setScanImages] = useState<Record<number, string | null>>({});

  const token = auth.token;

  useEffect(() => {
    getAiStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (!token) return;

    listScans(token)
      .then(setScans)
      .catch((err: any) => setError(err?.message ?? "Failed to load scans"));
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
  }, [scans, token]);

  const modelBadge = useMemo(() => {
    if (!status) {
      return { dot: "bad", text: "Unknown" } as const;
    }
    if (status.available) {
      return { dot: "ok", text: "AI brain online" } as const;
    }
    return { dot: "bad", text: "AI brain not ready" } as const;
  }, [status]);

  const latestScan = scans.length > 0 ? scans[0] : null;
  const latestResult: any = latestScan ? (latestScan as any).result ?? null : null;
  const latestFieldHealth = latestResult?.field_health;
  const latestFieldHealthPercent =
    latestFieldHealth && typeof latestFieldHealth.field_health_percent === "number"
      ? latestFieldHealth.field_health_percent
      : null;
  const latestDiseaseCount =
    latestFieldHealth && typeof latestFieldHealth.disease_count === "number"
      ? latestFieldHealth.disease_count
      : null;
  const latestTotalDetections =
    latestFieldHealth && typeof latestFieldHealth.total_detections === "number"
      ? latestFieldHealth.total_detections
      : Array.isArray(latestResult?.detections)
      ? latestResult.detections.length
      : null;
  const latestRecommendation =
    latestFieldHealth && typeof latestFieldHealth.recommendation === "string"
      ? latestFieldHealth.recommendation
      : null;
  const latestDrone = latestResult?.drone;

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("You are not authenticated");
      return;
    }

    if (!file) {
      setError("Please choose an image");
      return;
    }

    if (!droneName || !flightDuration || !droneAltitude || !location || !capturedAt) {
      setError("Please fill in all drone details");
      return;
    }

    setBusy(true);
    try {
      const created = await createScan(token, {
        file,
        drone_name: droneName,
        flight_duration: flightDuration,
        drone_altitude: droneAltitude,
        location,
        captured_at: capturedAt,
      });
      setScans((prev) => [created, ...prev]);
      setFile(null);
      setDroneName("");
      setFlightDuration("");
      setDroneAltitude("");
      setLocation("");
      setCapturedAt("");
      (document.getElementById("scan-file") as HTMLInputElement | null)?.value &&
        (((document.getElementById("scan-file") as HTMLInputElement | null)!).value = "");
    } catch (err: any) {
      setError(err?.message ?? "Failed to upload scan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ padding: "34px 0 54px" }}>
      <div className="grid grid-2">
        <div>
          <div className="badge">
            <span className={`badge-dot ${modelBadge.dot}`} /> {modelBadge.text}
          </div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Field dashboard
          </h1>
          <p className="p" style={{ marginTop: 14 }}>
            Welcome{auth.user?.full_name ? `, ${auth.user.full_name}` : ""}. Upload an image to
            generate a scan result and save it in your database.
          </p>

          <div className="hr" />

          <Card className="panel">
            <div className="h2">AI brain status</div>
            <div className="small" style={{ marginTop: 8 }}>
              Model path: {status?.model_path ?? "—"}
            </div>
            {!status?.available && status?.reason ? (
              <div className="notice bad" style={{ marginTop: 12 }}>
                {status.reason}
              </div>
            ) : null}
            {status?.available ? (
              <div className="notice ok" style={{ marginTop: 12 }}>
                Model loaded. Scans will run inference.
              </div>
            ) : null}
          </Card>

          <Card className="panel" style={{ marginTop: 16 }}>
            <div className="h2">Upload a new scan</div>
            <form onSubmit={onUpload} className="form" style={{ marginTop: 10 }}>
              <input
                className="input"
                type="text"
                placeholder="Drone name"
                value={droneName}
                onChange={(e) => setDroneName(e.target.value)}
              />
              <input
                className="input"
                type="text"
                placeholder="Flight duration (e.g. 15 min)"
                value={flightDuration}
                onChange={(e) => setFlightDuration(e.target.value)}
              />
              <input
                className="input"
                type="text"
                placeholder="Drone altitude (e.g. 120 m)"
                value={droneAltitude}
                onChange={(e) => setDroneAltitude(e.target.value)}
              />
              <input
                className="input"
                type="text"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <label className="small" style={{ marginTop: 4 }}>
                Capture date &amp; time
              </label>
              <input
                className="input"
                type="datetime-local"
                value={capturedAt}
                onChange={(e) => setCapturedAt(e.target.value)}
              />
              <input
                id="scan-file"
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {error ? <div className="notice bad">{error}</div> : null}
              <div className="form-actions">
                <Button type="submit" disabled={busy}>
                  {busy ? "Uploading…" : "Run scan"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setFile(null)}>
                  Reset
                </Button>
              </div>
              <div className="small">Uploaded images are stored in backend uploads/.</div>
            </form>
          </Card>
        </div>

        <div>
          <Card className="panel">
            <div className="h2">Recent scans</div>
            <div className="small" style={{ marginTop: 8 }}>
              Stored per user. Each scan includes the captured image and drone metadata.
            </div>

            <div className="hr" />

            {scans.length === 0 ? (
              <div className="small">No scans yet. Upload your first drone image.</div>
            ) : (
              <div className="scan-list">
                {scans.map((s) => {
                  const detections = Array.isArray((s as any).result?.detections)
                    ? (s as any).result.detections.length
                    : 0;

                  const drone = (s as any).result?.drone;
                  const imgUrl = scanImages[s.id] ?? null;

                  return (
                    <div className="scan-item" key={s.id}>
                      <div className="scan-main">
                        <div className="scan-title">Scan #{s.id}</div>
                        <div className="small">{formatTime(s.created_at)}</div>
                        <div className="small" style={{ marginTop: 6 }}>
                          Detections: {detections}
                        </div>
                        {drone ? (
                          <>
                            <div className="small" style={{ marginTop: 4 }}>
                              Drone: {drone.name || "—"} • Altitude: {drone.altitude || "—"} •
                              Duration: {drone.flight_duration || "—"}
                            </div>
                            <div className="small" style={{ marginTop: 2 }}>
                              Location: {drone.location || "—"}
                            </div>
                            {drone.captured_at ? (
                              <div className="small" style={{ marginTop: 2 }}>
                                Captured at: {drone.captured_at}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        <div style={{ marginTop: 10 }}>
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={`Scan ${s.id}`}
                              style={{
                                display: "block",
                                width: "100%",
                                maxHeight: 260,
                                objectFit: "cover",
                                borderRadius: 12,
                              }}
                            />
                          ) : (
                            <div className="small">Image preview not available.</div>
                          )}
                        </div>
                      </div>
                      <div className="scan-actions">
                        <details>
                          <summary className="link">Result JSON</summary>
                          <pre className="code">{JSON.stringify(s.result, null, 2)}</pre>
                        </details>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="panel" style={{ marginTop: 16 }}>
            <div className="h2">Field health summary</div>
            <div className="small" style={{ marginTop: 8 }}>
              Overview from your most recent scan.
            </div>

            <div className="hr" />

            {!latestScan || latestFieldHealthPercent === null ? (
              <div className="small">Run a scan to see field health insights here.</div>
            ) : (
              <>
                <div className="small">
                  Latest scan: #{latestScan.id} ({formatTime(latestScan.created_at)})
                </div>
                {latestDrone ? (
                  <div className="small" style={{ marginTop: 6 }}>
                    Drone: {latestDrone.name || "—"} • Altitude: {latestDrone.altitude || "—"} •
                    Duration: {latestDrone.flight_duration || "—"}
                  </div>
                ) : null}
                <div className="small" style={{ marginTop: 8 }}>
                  Field health: <strong>{latestFieldHealthPercent}%</strong>
                </div>
                <div className="small" style={{ marginTop: 2 }}>
                  Diseases detected: {latestDiseaseCount ?? "0"}
                  {latestTotalDetections !== null ? ` / ${latestTotalDetections} detections` : ""}
                </div>
                {latestRecommendation ? (
                  <div className="small" style={{ marginTop: 8 }}>
                    Treatment plan: {latestRecommendation}
                  </div>
                ) : null}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
