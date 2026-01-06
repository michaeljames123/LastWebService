import Card from "../components/Card";

export default function AboutPage() {
  return (
    <div className="container" style={{ padding: "34px 0 54px" }}>
      <div className="grid grid-2">
        <div>
          <div className="badge">
            <span className="badge-dot ok" /> Mission
          </div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Agriculture decisions,
            <br />
            powered by aerial vision.
          </h1>
          <p className="p" style={{ marginTop: 14 }}>
            AgridroneScan is a full-stack starter that combines authentication, data storage, and AI
            endpoints so you can focus on building real farming features.
          </p>
          <div style={{ marginTop: 14 }} className="small">
            Backend: FastAPI + SQLite • Frontend: React + Vite
          </div>
        </div>

        <Card className="stack">
          <div className="h2">What you get</div>
          <div className="hr" />
          <div className="grid" style={{ gap: 12 }}>
            <div className="stack-item">
              <div className="stack-title">Secure auth</div>
              <div className="small">Register/login with JWT-protected dashboard routes.</div>
            </div>
            <div className="stack-item">
              <div className="stack-title">SQLite database</div>
              <div className="small">Users, contact messages, and scan history included.</div>
            </div>
            <div className="stack-item">
              <div className="stack-title">AI-ready API</div>
              <div className="small">
                Plug in best.pt (Ultralytics YOLO). If the model isn’t available yet, the API returns
                a clear status message.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
