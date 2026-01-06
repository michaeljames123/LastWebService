import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Button from "./Button";

export default function QuickSidebar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  function go(path: string) {
    navigate(path);
    setOpen(false);
  }

  function handleLogout() {
    auth.logout();
    setOpen(false);
    navigate("/");
  }

  return (
    <>
      <button
        type="button"
        className="quick-sidebar-fab"
        aria-label="Open shortcuts sidebar"
        onClick={() => setOpen(true)}
      >
        ≡
      </button>

      <div
        className={"quick-sidebar-backdrop" + (open ? " open" : "")}
        onClick={() => setOpen(false)}
      />

      <div className={"quick-sidebar-drawer" + (open ? " open" : "")}>
        <div className="quick-sidebar-inner">
          <div className="quick-sidebar-header">
            <div className="small" style={{ fontWeight: 700 }}>Quick shortcuts</div>
            <button
              type="button"
              className="quick-sidebar-close"
              aria-label="Close shortcuts sidebar"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="quick-sidebar-body">
            <Button size="sm" variant="secondary" onClick={() => go("/dashboard")}>
              Dashboard
            </Button>
            <Button size="sm" variant="secondary" onClick={() => go("/estimate-field")}>
              Estimate Field
            </Button>
            <Button size="sm" variant="secondary" onClick={() => go("/profile")}>
              Profile
            </Button>
            <Button size="sm" variant="secondary" onClick={() => go("/about")}>
              About
            </Button>
            <Button size="sm" variant="secondary" onClick={() => go("/contact")}>
              Contact
            </Button>
          </div>

          <div style={{ marginTop: "auto", paddingTop: 8 }}>
            <Button size="sm" variant="ghost" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
