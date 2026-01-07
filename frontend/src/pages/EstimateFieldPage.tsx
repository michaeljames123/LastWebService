import React, { useEffect, useState } from "react";

import { API_BASE_URL, estimateField } from "../api/api";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import Card from "../components/Card";

const ESTIMATE_STORAGE_KEY = "agridronescan_estimate_latest";

export default function EstimateFieldPage() {
  const auth = useAuth();
  const token = auth.token;

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [annotatedBlobUrl, setAnnotatedBlobUrl] = useState<string | null>(null);
  const [originalBlobUrl, setOriginalBlobUrl] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);

  useEffect(() => {
    if (!token) return;

    try {
      const stored = window.localStorage.getItem(ESTIMATE_STORAGE_KEY);
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
  }, [token]);

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

    try {
      const res = await estimateField(token, file);
      setResult(res);
      try {
        window.localStorage.setItem(ESTIMATE_STORAGE_KEY, JSON.stringify(res));
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

  const predictions = Array.isArray(result?.predictions) ? result.predictions : [];
  const predCount = predictions.length;

  let cornCount = 0;
  for (const p of predictions) {
    if (!p || typeof p !== "object") continue;
    const anyPred = p as any;
    const label = String(
      anyPred.class ?? anyPred.class_name ?? anyPred.label ?? ""
    ).toLowerCase();
    if (label.includes("corn")) {
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

  const hasDetections = predCount > 0;

  let displayImageUrl: string | null = null;
  if (showBoxes) {
    displayImageUrl = annotatedBlobUrl || originalBlobUrl;
  } else {
    displayImageUrl = originalBlobUrl || annotatedBlobUrl;
  }

  return (
    <div className="container" style={{ padding: "24px 0 38px" }}>
      <h1 className="h1">Estimation Yield</h1>
      <p className="p" style={{ marginTop: 14 }}>
        Upload an image to run CVAT detection and get a bounding-box annotated yield result.
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
          {error ? <div className="notice bad">{error}</div> : null}
          <div className="form-actions">
            <Button type="submit" disabled={busy}>
              {busy ? "Analyzing…" : "Analyze"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setFile(null)}>
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
              <img
                src={displayImageUrl}
                alt={showBoxes && annotatedBlobUrl ? "Annotated result" : "Original image"}
                className="estimate-main-image"
              />
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
                  {yieldSummary ? (
                    <div className="small" style={{ marginTop: 8 }}>
                      {yieldSummary}
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
