import Card from "../components/Card";

export default function AboutPage() {
  return (
    <div className="container" style={{ padding: "34px 0 54px" }}>
      <div className="grid grid-2">
        <div>
          <div className="badge">
            <span className="badge-dot ok" /> About AgridroneScan
          </div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            From drone flight
            <br />
            to disease insight.
          </h1>
          <p className="p" style={{ marginTop: 14 }}>
            AgridroneScan is a field-ready web dashboard that turns drone images into crop health
            decisions. It is designed around Philippine farms: corn fields with bacterial stalk rot,
            rust, and leaf blight that need fast, visual answers after every flight.
          </p>
          <div style={{ marginTop: 14 }} className="small">
            Backend: FastAPI + SQLite • Frontend: React + Vite • AI: your own YOLO / Roboflow model
          </div>
        </div>

        <Card className="stack">
          <div className="h2">Philippine corn health, step by step</div>
          <div className="hr" />
          <div className="grid" style={{ gap: 12 }}>
            <div className="stack-item">
              <div className="stack-title">Common field problems</div>
              <div className="small">
                Focused on diseases seen in local corn fields such as bacterial stalk rot, leaf
                blight, rust, and irregular growth areas that reduce yield.
              </div>
            </div>
            <div className="stack-item">
              <div className="stack-title">Drone → system workflow</div>
              <div className="small">
                1) Fly the drone over your field.
                2) Capture top-down images.
                3) Upload a photo in the dashboard.
                4) The AI model detects diseases and healthy areas.
                5) AgridroneScan stores the scan and shows field health %.
              </div>
            </div>
            <div className="stack-item">
              <div className="stack-title">For agronomists and students</div>
              <div className="small">
                Use the dashboard to demonstrate how drones, AI, and farm records work together—from
                capturing images to making recommendations for treatment and monitoring.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
