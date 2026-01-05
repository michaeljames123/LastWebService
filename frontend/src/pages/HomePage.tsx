import React from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import Card from "../components/Card";

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <Card className="feature">
      <div className="feature-title">{title}</div>
      <div className="small" style={{ marginTop: 8 }}>
        {text}
      </div>
    </Card>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const auth = useAuth();

  return (
    <div>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <div className="badge">
              <span className="badge-dot ok" /> AI-ready • Drone-first
            </div>
            <h1 className="h1" style={{ marginTop: 12 }}>
              Make every hectare visible.
              <br />
              Scan fields with your A.I. brain.
            </h1>
            <p className="p" style={{ marginTop: 14, maxWidth: 620 }}>
              AgridroneScan connects drone imagery, smart detection, and field reports into one
              agriculture-focused dashboard. Plug in your Google Colab-trained model ({"best.pt"})
              and start analyzing crop conditions.
            </p>

            <div className="hero-actions">
              {auth.token ? (
                <>
                  <Button onClick={() => navigate("/dashboard")}>Open Dashboard</Button>
                  <Button variant="secondary" onClick={() => navigate("/contact")}> 
                    Talk to Us
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => navigate("/register")}>Get Started</Button>
                  <Button variant="secondary" onClick={() => navigate("/login")}> 
                    Sign In
                  </Button>
                </>
              )}
            </div>

            <div className="hr" />

            <div className="grid grid-3">
              <Feature
                title="Drone Scouting"
                text="Upload aerial images and keep a history of scans per user in SQLite."
              />
              <Feature
                title="AI Inference"
                text="Run detections with best.pt (YOLO/Ultralytics) and store results in your database."
              />
              <Feature
                title="Field Reports"
                text="Review scan results, confidence scores, and quickly export insights to your team."
              />
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "28px 0 44px" }}>
        <div className="container">
          <div className="grid grid-2">
            <Card variant="strong" className="cta">
              <div className="h2">Built for agriculture workflows</div>
              <p className="p" style={{ marginTop: 10 }}>
                From seedling to harvest, you need fast answers. AgridroneScan is designed around
                the reality of farms: quick scouting, reliable storage, and clear results.
              </p>
              <div style={{ marginTop: 14 }}>
                <span className="kbd">Crop health</span> <span className="kbd">Pest detection</span>{" "}
                <span className="kbd">Irrigation checks</span>
              </div>
            </Card>

            <Card className="cta">
              <div className="h2">Bring your own model</div>
              <p className="p" style={{ marginTop: 10 }}>
                Your A.I. brain stays yours. Point the backend to your Colab-exported model file and
                deploy locally.
              </p>
              <div style={{ marginTop: 14 }}>
                <Button variant="ghost" onClick={() => navigate("/about")}> 
                  Learn how it works
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
