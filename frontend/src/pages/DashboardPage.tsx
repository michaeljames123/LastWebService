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

type DetectionPolygon = {
  id: number;
  points: { x: number; y: number }[];
  confidence: number | null;
  kind: "healthy" | "irregular" | "disease";
};

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
  const [fieldSize, setFieldSize] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [scanImages, setScanImages] = useState<Record<number, string | null>>({});
  const [confidenceThreshold, setConfidenceThreshold] = useState(40);
  const [maskOpacity, setMaskOpacity] = useState(60);

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
          const originalPath = s.image_url.replace(/\/image$/, "/original-image");
          const res = await fetch(`${API_BASE_URL}${originalPath}`, {
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
  const latestDetectionsRaw: any[] = Array.isArray(latestResult?.detections)
    ? (latestResult.detections as any[])
    : [];
  const latestPredictions = latestDetectionsRaw
    .filter((d) => d && typeof d === "object")
    .map((d, index) => {
      const anyDet = d as any;
      const labelValue =
        anyDet.class_name ??
        anyDet.label ??
        anyDet.name ??
        (typeof anyDet.class_id !== "undefined" ? String(anyDet.class_id) : `Prediction ${index + 1}`);
      const label = String(labelValue || "").trim() || `Prediction ${index + 1}`;

      let confidence: number | null = null;
      if (typeof anyDet.confidence === "number") {
        confidence = anyDet.confidence;
      } else if (typeof anyDet.confidence === "string") {
        const parsed = parseFloat(anyDet.confidence);
        confidence = Number.isFinite(parsed) ? parsed : null;
      }

      return { id: index + 1, label, confidence };
    })
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 5);

  const filteredPredictions = latestPredictions.filter((p) => {
    if (p.confidence == null) {
      return true;
    }
    return p.confidence * 100 >= confidenceThreshold;
  });

  const detectionPolygons: DetectionPolygon[] = useMemo(() => {
    const raw = Array.isArray(latestResult?.detections) ? (latestResult.detections as any[]) : [];
    const out: DetectionPolygon[] = [];

    raw.forEach((det, index) => {
      if (!det || typeof det !== "object") return;
      const anyDet = det as any;

      const polyNorm = Array.isArray(anyDet.polygon_normalized) ? anyDet.polygon_normalized : null;
      if (!polyNorm || polyNorm.length === 0) return;

      const points: { x: number; y: number }[] = [];
      for (const p of polyNorm) {
        if (Array.isArray(p) && p.length === 2) {
          const x = Number(p[0]);
          const y = Number(p[1]);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            points.push({ x, y });
          }
        }
      }
      if (points.length < 3) return;

      let confidence: number | null = null;
      if (typeof anyDet.confidence === "number") {
        confidence = anyDet.confidence;
      } else if (typeof anyDet.confidence === "string") {
        const parsed = parseFloat(anyDet.confidence);
        confidence = Number.isFinite(parsed) ? parsed : null;
      }

      const labelRaw = String(
        anyDet.class_name ??
          anyDet.label ??
          anyDet.name ??
          (typeof anyDet.class_id !== "undefined" ? anyDet.class_id : "")
      ).toLowerCase();

      let kind: "healthy" | "irregular" | "disease" = "disease";
      if (labelRaw.includes("healthy")) {
        kind = "healthy";
      } else if (labelRaw.includes("irregular")) {
        kind = "irregular";
      } else if (
        labelRaw.includes("disease") ||
        labelRaw.includes("blight") ||
        labelRaw.includes("rust") ||
        labelRaw.includes("rot") ||
        labelRaw.includes("wilt") ||
        labelRaw.includes("mold") ||
        labelRaw.includes("pest") ||
        labelRaw.includes("infect")
      ) {
        kind = "disease";
      }

      out.push({ id: index + 1, points, confidence, kind });
    });

    return out;
  }, [latestResult]);

  const visiblePolygons = useMemo(
    () =>
      detectionPolygons.filter(
        (p) => p.confidence == null || p.confidence * 100 >= confidenceThreshold
      ),
    [detectionPolygons, confidenceThreshold]
  );

  function resetForm() {
    setFile(null);
    setDroneName("");
    setFlightDuration("");
    setDroneAltitude("");
    setLocation("");
    setFieldSize("");
    setCapturedAt("");
    setError(null);
    const input = document.getElementById("scan-file") as HTMLInputElement | null;
    if (input) {
      input.value = "";
    }
  }

  function predictionLabelClass(label: string): string {
    const lower = label.toLowerCase();
    if (lower.includes("healthy")) return "healthy";
    if (lower.includes("irregular")) return "irregular";
    if (
      lower.includes("disease") ||
      lower.includes("blight") ||
      lower.includes("rust") ||
      lower.includes("rot") ||
      lower.includes("wilt") ||
      lower.includes("mold") ||
      lower.includes("pest") ||
      lower.includes("infect")
    ) {
      return "disease";
    }
    return "disease";
  }

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

    if (!droneName || !flightDuration || !droneAltitude || !location || !fieldSize || !capturedAt) {
      setError("Please fill in all drone details, including field size");
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
        field_size: fieldSize,
        captured_at: capturedAt,
      });
      setScans((prev) => [created, ...prev]);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to upload scan";
      if (msg === "Could not validate credentials") {
        auth.logout();
        return;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ padding: "24px 0 38px" }}>
      <div className="badge">
        <span className={`badge-dot ${modelBadge.dot}`} /> {modelBadge.text}
      </div>
      <h1 className="h1" style={{ marginTop: 12 }}>
        Field dashboard
      </h1>
      <p className="p" style={{ marginTop: 14 }}>
        Welcome{auth.user?.full_name ? `, ${auth.user.full_name}` : ""}. Upload an image to generate a
        scan result and save it in your database.
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

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div>
          <Card className="panel">
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
              <input
                className="input"
                type="text"
                placeholder="Field size (e.g. 2 hectares or 5 acres)"
                value={fieldSize}
                onChange={(e) => setFieldSize(e.target.value)}
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
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Reset
                </Button>
              </div>
              <div className="small">Uploaded images are stored in backend uploads/.</div>
            </form>
          </Card>
        </div>

        <div>
          <Card className="panel">
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
                    {latestDrone.field_size ? ` • Field size: ${latestDrone.field_size}` : ""}
                  </div>
                ) : null}
                <div className="small" style={{ marginTop: 8 }}>
                  Field health: <strong>{latestFieldHealthPercent}%</strong>
                </div>
                <div className="health-bar">
                  <div
                    className={`health-bar-fill ${
                      latestFieldHealthPercent >= 70
                        ? "good"
                        : latestFieldHealthPercent >= 40
                        ? "medium"
                        : "bad"
                    }`}
                    style={{ width: `${latestFieldHealthPercent}%` }}
                  />
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

      <Card className="panel scan-results-wide" style={{ marginTop: 20 }}>
        <div className="h2">Scan results</div>
        <div className="small" style={{ marginTop: 8 }}>
          Latest analysis from your most recent drone upload.
        </div>

        <div className="hr" />

        {!latestScan ? (
          <div className="small">No scans yet. Upload your first drone image.</div>
        ) : (
          <div className="scan-results-layout">
            <div>
              <div className="scan-title">Scan #{latestScan.id}</div>
              <div className="small">{formatTime(latestScan.created_at)}</div>
              <div className="small" style={{ marginTop: 6 }}>
                Detections: {Array.isArray(latestResult?.detections) ? latestResult.detections.length : 0}
              </div>
              {latestDrone ? (
                <>
                  <div className="small" style={{ marginTop: 4 }}>
                    Drone: {latestDrone.name || "—"} • Altitude: {latestDrone.altitude || "—"} • Duration:{" "}
                    {latestDrone.flight_duration || "—"}
                    {latestDrone.field_size ? ` • Field size: ${latestDrone.field_size}` : ""}
                  </div>
                  <div className="small" style={{ marginTop: 2 }}>
                    Location: {latestDrone.location || "—"}
                  </div>
                  {latestDrone.captured_at ? (
                    <div className="small" style={{ marginTop: 2 }}>
                      Captured at: {latestDrone.captured_at}
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className="scan-controls">
                <div className="scan-slider">
                  <div className="scan-slider-header">
                    <span className="small">Confidence Threshold:</span>
                    <span className="small" style={{ fontWeight: 600 }}>
                      {confidenceThreshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="scan-slider-range"
                  />
                  <div className="scan-slider-footer">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="scan-slider">
                  <div className="scan-slider-header">
                    <span className="small">Mask opacity:</span>
                    <span className="small" style={{ fontWeight: 600 }}>
                      {maskOpacity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={maskOpacity}
                    onChange={(e) => setMaskOpacity(Number(e.target.value))}
                    className="scan-slider-range"
                  />
                  <div className="scan-slider-footer">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                {latestScan && scanImages[latestScan.id] ? (
                  <div className="scan-image-wrapper">
                    <img
                      src={scanImages[latestScan.id] as string}
                      alt={`Scan ${latestScan.id}`}
                      className="scan-results-wide-image"
                    />
                    {visiblePolygons.length > 0 ? (
                      <svg
                        className="scan-overlay"
                        viewBox="0 0 1 1"
                        preserveAspectRatio="none"
                      >
                        {visiblePolygons.map((poly) => {
                          let color: [number, number, number];
                          if (poly.kind === "healthy") {
                            color = [72, 199, 116];
                          } else if (poly.kind === "irregular") {
                            color = [132, 94, 247];
                          } else {
                            color = [255, 90, 95];
                          }
                          const fillOpacity = Math.max(0, Math.min(1, maskOpacity / 100));
                          return (
                            <polygon
                              key={poly.id}
                              points={poly.points
                                .map((p) => `${p.x} ${p.y}`)
                                .join(" ")}
                              fill={`rgba(${color[0]}, ${color[1]}, ${color[2]}, ${fillOpacity})`}
                              stroke={`rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`}
                              strokeWidth={0.003}
                            />
                          );
                        })}
                      </svg>
                    ) : null}
                  </div>
                ) : (
                  <div className="small">Image preview not available.</div>
                )}
              </div>
              <div className="scan-actions" style={{ marginTop: 12 }}>
                <details>
                  <summary className="link">Result JSON</summary>
                  <pre className="code">{JSON.stringify(latestResult, null, 2)}</pre>
                </details>
              </div>
            </div>

            <div>
              <div className="small" style={{ fontWeight: 700 }}>
                Predictions
              </div>
              {latestPredictions.length === 0 ? (
                <div className="small" style={{ marginTop: 6 }}>
                  No prediction details available for this scan.
                </div>
              ) : filteredPredictions.length === 0 ? (
                <div className="small" style={{ marginTop: 6 }}>
                  No predictions above the current confidence threshold.
                </div>
              ) : (
                <div className="prediction-list">
                  {filteredPredictions.map((p) => (
                    <div className="prediction-item" key={p.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="small" style={{ opacity: 0.7 }}>
                          #{p.id}
                        </span>
                        <span className={`prediction-label ${predictionLabelClass(p.label)}`}>
                          {p.label}
                        </span>
                      </div>
                      <div className="prediction-score">
                        {p.confidence != null ? `${(p.confidence * 100).toFixed(1)}%` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
