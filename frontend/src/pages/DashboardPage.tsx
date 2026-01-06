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

  const token = auth.token;

  async function viewImage(imageUrl: string) {
    setError(null);

    if (!token) {
      setError("You are not authenticated");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}${imageUrl}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = text || res.statusText;
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === "object" && "detail" in parsed) {
            msg = String((parsed as any).detail);
          }
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load image");
    }
  }

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

  const modelBadge = useMemo(() => {
    if (!status) {
      return { dot: "bad", text: "Unknown" } as const;
    }
    if (status.available) {
      return { dot: "ok", text: "AI brain online" } as const;
    }
    return { dot: "bad", text: "AI brain not ready" } as const;
  }, [status]);

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
              Stored per user. Click to view the image.
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
                  const fieldHealth = (s as any).result?.field_health;
                  const fieldHealthPercent =
                    fieldHealth && typeof fieldHealth.field_health_percent === "number"
                      ? fieldHealth.field_health_percent
                      : null;
                  const diseaseCount =
                    fieldHealth && typeof fieldHealth.disease_count === "number"
                      ? fieldHealth.disease_count
                      : null;
                  const totalDetections =
                    fieldHealth && typeof fieldHealth.total_detections === "number"
                      ? fieldHealth.total_detections
                      : detections;
                  const recommendation =
                    fieldHealth && typeof fieldHealth.recommendation === "string"
                      ? fieldHealth.recommendation
                      : null;

                  return (
                    <div className="scan-item" key={s.id}>
                      <div>
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
                        {fieldHealthPercent !== null ? (
                          <div className="small" style={{ marginTop: 4 }}>
                            Field health: {fieldHealthPercent}% (diseases: {diseaseCount ?? "0"} /
                            {" "}
                            {totalDetections})
                          </div>
                        ) : null}
                        {recommendation ? (
                          <div className="small" style={{ marginTop: 2 }}>
                            Recommendation: {recommendation}
                          </div>
                        ) : null}
                      </div>
                      <div className="scan-actions">
                        <button
                          className="link"
                          type="button"
                          onClick={() => viewImage(s.image_url)}
                        >
                          View image
                        </button>
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
        </div>
      </div>
    </div>
  );
}
