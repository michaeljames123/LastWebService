import React, { useEffect, useState } from "react";

import { API_BASE_URL, estimateField } from "../api/api";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import Card from "../components/Card";

const ESTIMATE_STORAGE_KEY = "agridronescan_estimate_latest";

export default function EstimateFieldPage() {
  const auth = useAuth();
  const token = auth.token;
  const userId = auth.user?.id;

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [annotatedBlobUrl, setAnnotatedBlobUrl] = useState<string | null>(null);
  const [originalBlobUrl, setOriginalBlobUrl] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [altitude, setAltitude] = useState<string>("");
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(40);

  useEffect(() => {
    // Clear any previous in-memory state whenever the authenticated user changes
    setResult(null);
    setAnnotatedBlobUrl(null);
    setOriginalBlobUrl(null);

    if (!token || !userId) return;

    try {
      const storageKey = `${ESTIMATE_STORAGE_KEY}_${userId}`;
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return;

      setResult(parsed);

      const annotatedUrl = (parsed as any).annotated_image_url;
      const originalUrl = (parsed as any).original_image_url;

      if (typeof annotatedUrl === "string" && annotatedUrl) {
        void loadImage(annotatedUrl, setAnnotatedBlobUrl).catch(() => undefined);
      }
      if (typeof originalUrl === "string" && originalUrl) {
        void loadImage(originalUrl, setOriginalBlobUrl).catch(() => undefined);
      }
    } catch {
      // Ignore malformed stored data
    }
  }, [token, userId]);

  async function loadImage(imageUrl: string, setter: (url: string | null) => void) {
    if (!token) return;

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

    setter(blobUrl);
  }

  async function onAnalyze(e: React.FormEvent) {
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

    setBusy(true);
    setResult(null);
    setAnnotatedBlobUrl(null);
    setOriginalBlobUrl(null);
    setShowBoxes(true);

    let altitudeMeters: number | undefined = undefined;
    if (altitude.trim()) {
      const parsed = Number(altitude.trim());
      if (!Number.isNaN(parsed) && parsed > 0) {
        altitudeMeters = parsed;
      }
    }

    try {
      const res = await estimateField(token, file, altitudeMeters);
      setResult(res);
      try {
        if (userId) {
          const storageKey = `${ESTIMATE_STORAGE_KEY}_${userId}`;
          window.localStorage.setItem(storageKey, JSON.stringify(res));
        }
      } catch {
        // Ignore storage failures (e.g. private mode)
      }

      const annotatedUrl = res?.annotated_image_url;
      const originalUrl = res?.original_image_url;
      if (typeof annotatedUrl === "string" && annotatedUrl) {
        await loadImage(annotatedUrl, setAnnotatedBlobUrl);
      }
      if (typeof originalUrl === "string" && originalUrl) {
        await loadImage(originalUrl, setOriginalBlobUrl);
      }

      setFile(null);
      (document.getElementById("estimate-file") as HTMLInputElement | null)?.value &&
        (((document.getElementById("estimate-file") as HTMLInputElement | null)!).value = "");
    } catch (err: any) {
      setError(err?.message ?? "Estimate Field failed");
    } finally {
      setBusy(false);
    }
  }

  const rawPredictions: any[] = Array.isArray(result?.predictions) ? result.predictions : [];

  const parsedPredictions = rawPredictions
    .filter((p) => p && typeof p === "object")
    .map((p: any) => {
      const label = String(
        p.class ?? p.class_name ?? p.label ?? p.name ?? ""
      ).toLowerCase();

      let confidence: number | null = null;
      if (typeof p.confidence === "number") {
        confidence = p.confidence;
      } else if (typeof p.confidence === "string") {
        const parsed = parseFloat(p.confidence);
        confidence = Number.isFinite(parsed) ? parsed : null;
      }

      return { label, confidence };
    });

  const filteredPredictions = parsedPredictions.filter((p) => {
    if (p.confidence == null) {
      return true;
    }
    return p.confidence * 100 >= confidenceThreshold;
  });

  const totalPredCount = parsedPredictions.length;
  const predCount = filteredPredictions.length;

  let cornCount = 0;
  for (const p of filteredPredictions) {
    if (p.label.includes("corn")) {
      cornCount += 1;
    }
  }

  const yieldEstimate = result?.yield_estimate;
  const overallYieldIndex =
    yieldEstimate && typeof yieldEstimate.overall_yield_index === "number"
      ? yieldEstimate.overall_yield_index
      : null;
  const kernelScore =
    yieldEstimate && typeof yieldEstimate.kernel_development_score === "number"
      ? yieldEstimate.kernel_development_score
      : null;
  const discolorationIndex =
    yieldEstimate && typeof yieldEstimate.discoloration_index === "number"
      ? yieldEstimate.discoloration_index
      : null;
  const drynessIndex =
    yieldEstimate && typeof yieldEstimate.leaf_dryness_index === "number"
      ? yieldEstimate.leaf_dryness_index
      : null;
  const yieldSummary =
    typeof yieldEstimate?.summary === "string" ? yieldEstimate.summary : null;

  const fieldArea = result?.field_area && typeof result.field_area === "object"
    ? (result.field_area as any)
    : null;

  const fieldAltitude =
    fieldArea && typeof fieldArea.altitude_m === "number"
      ? fieldArea.altitude_m
      : null;
  const fieldWidthM =
    fieldArea && typeof fieldArea.width_m === "number" ? fieldArea.width_m : null;
  const fieldHeightM =
    fieldArea && typeof fieldArea.height_m === "number" ? fieldArea.height_m : null;
  const fieldAreaM2 =
    fieldArea && typeof fieldArea.area_m2 === "number" ? fieldArea.area_m2 : null;
  const fieldAreaHa =
    fieldArea && typeof fieldArea.area_hectares === "number"
      ? fieldArea.area_hectares
      : null;
  const fieldAreaAcres =
    fieldArea && typeof fieldArea.area_acres === "number" ? fieldArea.area_acres : null;

  const overlayBoxesRaw: any[] = Array.isArray(result?.overlay_boxes)
    ? (result.overlay_boxes as any[])
    : [];

  const overlayBoxes = overlayBoxesRaw
    .filter((b) => b && typeof b === "object")
    .map((b: any) => {
      const x1 = Number(b.x1);
      const y1 = Number(b.y1);
      const x2 = Number(b.x2);
      const y2 = Number(b.y2);

      let confidence: number | null = null;
      if (typeof b.confidence === "number") {
        confidence = b.confidence;
      } else if (typeof b.confidence === "string") {
        const parsed = parseFloat(b.confidence);
        confidence = Number.isFinite(parsed) ? parsed : null;
      }

      const label = String(b.label ?? "object").toLowerCase();

      if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
        return null;
      }
      if (x2 <= x1 || y2 <= y1) {
        return null;
      }

      return { x1, y1, x2, y2, label, confidence };
    })
    .filter((b): b is { x1: number; y1: number; x2: number; y2: number; label: string; confidence: number | null } => !!b);

  const visibleOverlayBoxes = overlayBoxes.filter((b) => {
    if (b.confidence == null) return true;
    return b.confidence * 100 >= confidenceThreshold;
  });

  const hasDetections = totalPredCount > 0;

  let displayImageUrl: string | null = null;
  displayImageUrl = originalBlobUrl || annotatedBlobUrl;

  function resetEstimate() {
    setFile(null);
    setError(null);
    setResult(null);
    setShowBoxes(true);
    setAltitude("");
    setConfidenceThreshold(40);

    setAnnotatedBlobUrl((prev) => {
      if (prev) {
        window.URL.revokeObjectURL(prev);
      }
      return null;
    });
    setOriginalBlobUrl((prev) => {
      if (prev) {
        window.URL.revokeObjectURL(prev);
      }
      return null;
    });

    if (userId) {
      try {
        const storageKey = `${ESTIMATE_STORAGE_KEY}_${userId}`;
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore storage errors
      }
    }

    const input = document.getElementById("estimate-file") as HTMLInputElement | null;
    if (input) {
      input.value = "";
    }
  }

  return (
    <div className="container" style={{ padding: "24px 0 38px" }}>
      <h1 className="h1">Estimation Yield</h1>
      <p className="p" style={{ marginTop: 14 }}>
        Upload an image to run CVAT detection and get a bounding-box annotated yield and index result.
      </p>

      <div className="hr" />

      <Card className="panel">
        <div className="h2">Upload image</div>
        <form onSubmit={onAnalyze} className="form" style={{ marginTop: 10 }}>
          <input
            id="estimate-file"
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <label className="field" style={{ marginTop: 10 }}>
            <span className="field-label">Drone altitude (meters)</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.1"
              value={altitude}
              onChange={(e) => setAltitude(e.target.value)}
              placeholder="e.g. 25"
            />
          </label>
          {error ? <div className="notice bad">{error}</div> : null}
          <div className="form-actions">
            <Button type="submit" disabled={busy}>
              {busy ? "Analyzing…" : "Analyze"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetEstimate}>
              Reset
            </Button>
          </div>
          <div className="small">Model YOLOV8 results are rendered locally and saved in backend uploads/.</div>
        </form>
      </Card>

      <Card className="panel" style={{ marginTop: 20 }}>
        <div className="h2">Result</div>
        <div className="small" style={{ marginTop: 8 }}>
          {result
            ? `Predictions: ${predCount} • Estimated corn plants: ${cornCount}`
            : "No result yet. Upload an image to start."}
        </div>

        <div className="hr" />

        <div className="estimate-layout">
          <div>
            <div className="small" style={{ marginBottom: 8 }}>
              <label className="sidebar-toggle">
                <span>Show boxes on image</span>
                <input
                  type="checkbox"
                  checked={showBoxes}
                  onChange={(e) => setShowBoxes(e.target.checked)}
                />
              </label>
            </div>

            {displayImageUrl ? (
              <div className="scan-image-wrapper">
                <img
                  src={displayImageUrl}
                  alt={showBoxes ? "Annotated result" : "Original image"}
                  className="estimate-main-image"
                />
                {showBoxes && visibleOverlayBoxes.length > 0 ? (
                  <svg className="scan-overlay" viewBox="0 0 1 1" preserveAspectRatio="none">
                    {visibleOverlayBoxes.map((b, idx) => (
                      <rect
                        key={idx}
                        x={b.x1}
                        y={b.y1}
                        width={b.x2 - b.x1}
                        height={b.y2 - b.y1}
                        fill="rgba(0, 200, 83, 0.18)"
                        stroke="rgba(0, 230, 118, 0.95)"
                        strokeWidth={0.003}
                      />
                    ))}
                  </svg>
                ) : null}
              </div>
            ) : (
              <div className="small">Result image will appear here after analysis.</div>
            )}

            {result ? (
              <div style={{ marginTop: 14 }}>
                <details>
                  <summary className="link">Predictions JSON</summary>
                  <pre className="code">{JSON.stringify(result, null, 2)}</pre>
                </details>
              </div>
            ) : null}
          </div>

          <aside className="estimate-sidebar">
            <div className="estimate-sidebar-card">
              <div className="stack-title">Summary</div>
              {result ? (
                <>
                  <div className="estimate-metric-row">
                    <div className="estimate-metric">
                      <div className="estimate-metric-label">Predictions</div>
                      <div className="estimate-metric-value">{predCount}</div>
                    </div>
                    <div className="estimate-metric">
                      <div className="estimate-metric-label">Estimated corn plants</div>
                      <div className="estimate-metric-value">{cornCount}</div>
                    </div>
                    {overallYieldIndex !== null ? (
                      <div className="estimate-metric">
                        <div className="estimate-metric-label">Yield index</div>
                        <div className="estimate-metric-value">{overallYieldIndex}%</div>
                      </div>
                    ) : null}
                  </div>
                  <div className="estimate-metric-row" style={{ marginTop: 10 }}>
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
                  </div>
                  {yieldSummary ? (
                    <div className="small" style={{ marginTop: 8 }}>
                      {yieldSummary}
                    </div>
                  ) : null}
                  {fieldAreaM2 !== null && fieldAreaHa !== null && fieldAreaAcres !== null ? (
                    <div className="estimate-metric-bars" style={{ marginTop: 8 }}>
                      <div className="metric-bar">
                        <div className="metric-bar-header">
                          <span>Estimated footprint (m²)</span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: "#1e88e5", // blue highlight
                            }}
                          >
                            {fieldAreaM2.toFixed(0)}
                          </span>
                        </div>
                      </div>
                      <div className="metric-bar">
                        <div className="metric-bar-header">
                          <span>Estimated area (hectares)</span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: "#2e7d32", // green highlight
                            }}
                          >
                            {fieldAreaHa.toFixed(3)}
                          </span>
                        </div>
                      </div>
                      <div className="metric-bar">
                        <div className="metric-bar-header">
                          <span>Estimated area (acres)</span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: "#f9a825", // amber highlight
                            }}
                          >
                            {fieldAreaAcres.toFixed(3)}
                          </span>
                        </div>
                      </div>
                      {fieldAltitude !== null && (fieldWidthM !== null || fieldHeightM !== null) ? (
                        <div className="small" style={{ marginTop: 6 }}>
                          Calculated assuming altitude of approximately {fieldAltitude.toFixed(1)} m
                          {fieldWidthM !== null && fieldHeightM !== null
                            ? ` and image footprint about ${fieldWidthM.toFixed(1)} m × ${fieldHeightM.toFixed(1)} m.`
                            : "."}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {hasDetections &&
                  (kernelScore !== null || discolorationIndex !== null || drynessIndex !== null) ? (
                    <div className="estimate-metric-bars">
                      {kernelScore !== null ? (
                        <div className="metric-bar">
                          <div className="metric-bar-header">
                            <span>Kernel development</span>
                            <span>{kernelScore}%</span>
                          </div>
                          <div className="metric-bar-track">
                            <div
                              className="metric-bar-fill positive"
                              style={{ width: `${kernelScore}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {discolorationIndex !== null ? (
                        <div className="metric-bar">
                          <div className="metric-bar-header">
                            <span>Discoloration index</span>
                            <span>{discolorationIndex}%</span>
                          </div>
                          <div className="metric-bar-track">
                            <div
                              className="metric-bar-fill warning"
                              style={{ width: `${discolorationIndex}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {drynessIndex !== null ? (
                        <div className="metric-bar">
                          <div className="metric-bar-header">
                            <span>Leaf dryness index</span>
                            <span>{drynessIndex}%</span>
                          </div>
                          <div className="metric-bar-track">
                            <div
                              className="metric-bar-fill negative"
                              style={{ width: `${drynessIndex}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="small" style={{ marginTop: 6 }}>
                  No result yet. Upload an image to start.
                </div>
              )}
            </div>
            <div className="estimate-sidebar-card">
              <div className="stack-title">Display options</div>
              <div className="small" style={{ marginTop: 6 }}>
                Use the "Show boxes" switch to focus either on the raw image or the AI overlay
                during demonstrations.
              </div>
            </div>
            <div className="estimate-sidebar-card">
              <div className="stack-title">Tips</div>
              <div className="small" style={{ marginTop: 6 }}>
                Fly at a consistent altitude with good lighting. Save important scans and field
                notes so you can compare plant health over time.
              </div>
            </div>
          </aside>
        </div>
      </Card>
    </div>
  );
}
