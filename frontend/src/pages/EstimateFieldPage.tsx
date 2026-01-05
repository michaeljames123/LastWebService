import React, { useEffect, useState } from "react";

import { API_BASE_URL, estimateField } from "../api/api";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import Card from "../components/Card";

export default function EstimateFieldPage() {
  const auth = useAuth();
  const token = auth.token;

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageBlobUrl) {
        window.URL.revokeObjectURL(imageBlobUrl);
      }
    };
  }, [imageBlobUrl]);

  async function loadAnnotatedImage(imageUrl: string) {
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

    setImageBlobUrl((prev) => {
      if (prev) {
        window.URL.revokeObjectURL(prev);
      }
      return blobUrl;
    });
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
    setImageBlobUrl((prev) => {
      if (prev) {
        window.URL.revokeObjectURL(prev);
      }
      return null;
    });

    try {
      const res = await estimateField(token, file);
      setResult(res);

      const imageUrl = res?.annotated_image_url;
      if (typeof imageUrl === "string" && imageUrl) {
        await loadAnnotatedImage(imageUrl);
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

  const predCount = Array.isArray(result?.predictions) ? result.predictions.length : 0;

  return (
    <div className="container" style={{ padding: "34px 0 54px" }}>
      <div className="grid grid-2">
        <div>
          <h1 className="h1">Estimate Field</h1>
          <p className="p" style={{ marginTop: 14 }}>
            Upload an image to run Roboflow detection and get a bounding-box annotated result.
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
              <div className="small">Roboflow results are rendered locally and saved in backend uploads/.</div>
            </form>
          </Card>
        </div>

        <div>
          <Card className="panel">
            <div className="h2">Result</div>
            <div className="small" style={{ marginTop: 8 }}>
              {result ? `Predictions: ${predCount}` : "No result yet. Upload an image to start."}
            </div>

            <div className="hr" />

            {imageBlobUrl ? (
              <img
                src={imageBlobUrl}
                alt="Annotated result"
                style={{ width: "100%", borderRadius: 14, display: "block" }}
              />
            ) : (
              <div className="small">Annotated image will appear here.</div>
            )}

            {result ? (
              <div style={{ marginTop: 14 }}>
                <details>
                  <summary className="link">Predictions JSON</summary>
                  <pre className="code">{JSON.stringify(result, null, 2)}</pre>
                </details>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
