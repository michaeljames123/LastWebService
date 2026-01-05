import React, { useState } from "react";

import Button from "../components/Button";
import Card from "../components/Card";
import { submitContact } from "../api/api";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("Field inquiry");
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      await submitContact({ name, email, subject, message });
      setStatus("sent");
      setName("");
      setEmail("");
      setSubject("Field inquiry");
      setMessage("");
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Failed to send message");
    }
  }

  return (
    <div className="container" style={{ padding: "34px 0 54px" }}>
      <div className="grid grid-2">
        <div>
          <h1 className="h1">Contact us</h1>
          <p className="p" style={{ marginTop: 12 }}>
            Need help integrating your drone workflow or AI model? Send us a message and we’ll get
            back to you.
          </p>
          <div style={{ marginTop: 14 }}>
            <span className="kbd">Support</span> <span className="kbd">Integrations</span>{" "}
            <span className="kbd">Partnerships</span>
          </div>
        </div>

        <Card className="form-card">
          <form onSubmit={onSubmit} className="form">
            <label className="field">
              <span className="field-label">Name</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@farm.com"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Subject</span>
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Message</span>
              <textarea
                className="textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you want to build…"
                required
                rows={5}
              />
            </label>

            {status === "sent" ? (
              <div className="notice ok">Message sent. We’ll respond soon.</div>
            ) : null}

            {status === "error" ? <div className="notice bad">{error}</div> : null}

            <div className="form-actions">
              <Button type="submit" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send message"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setName("");
                  setEmail("");
                  setMessage("");
                  setError(null);
                  setStatus("idle");
                }}
              >
                Clear
              </Button>
            </div>

            <div className="small" style={{ marginTop: 10 }}>
              Messages are stored in your SQLite database.
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
