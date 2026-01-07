import { useEffect, useMemo, useState } from "react";

import { adminDeleteScan, adminDeleteUser, adminListScans, adminListUsers, getAdminOverview } from "../api/api";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import Card from "../components/Card";
import type { AdminOverview, AdminScan, User } from "../types";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminDashboardPage() {
  const auth = useAuth();
  const token = auth.token;

  const [tab, setTab] = useState<"overview" | "users" | "scans">("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [scans, setScans] = useState<AdminScan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function load() {
      const tk = token;
      if (!tk) return;
      setLoading(true);
      setError(null);
      try {
        const [ov, us, sc] = await Promise.all([
          getAdminOverview(tk),
          adminListUsers(tk),
          adminListScans(tk),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setUsers(us);
        setScans(sc);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? "Failed to load admin data");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const maxScanCount = useMemo(() => {
    if (!overview) return 0;
    return Math.max(0, ...overview.scans_last_7_days.map((d) => d.count));
  }, [overview]);

  async function onToggleUserActive(user: User) {
    if (!token) return;
    try {
      const updated = await adminDeleteOrToggleUser(token, user, false);
      if (!updated) return;
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err: any) {
      setError(err?.message ?? "Failed to update user");
    }
  }

  async function onDeleteUser(user: User) {
    if (!token) return;
    if (!window.confirm(`Delete user ${user.username}? This cannot be undone.`)) return;
    try {
      await adminDeleteUser(token, user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete user");
    }
  }

  async function onDeleteScan(scan: AdminScan) {
    if (!token) return;
    if (!window.confirm(`Delete scan #${scan.id}?`)) return;
    try {
      await adminDeleteScan(token, scan.id);
      setScans((prev) => prev.filter((s) => s.id !== scan.id));
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete scan");
    }
  }

  return (
    <div className="container" style={{ padding: "24px 0 38px" }}>
      <div className="badge">
        <span className="badge-dot ok" /> Admin dashboard
      </div>
      <h1 className="h1" style={{ marginTop: 12 }}>
        Control panel
      </h1>
      <p className="p" style={{ marginTop: 14 }}>
        Monitor users, review scans, and keep an eye on platform activity.
      </p>

      <div className="hr" />

      <div className="admin-tabs">
        <button
          type="button"
          className={tab === "overview" ? "admin-tab active" : "admin-tab"}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={tab === "users" ? "admin-tab active" : "admin-tab"}
          onClick={() => setTab("users")}
        >
          Users
        </button>
        <button
          type="button"
          className={tab === "scans" ? "admin-tab active" : "admin-tab"}
          onClick={() => setTab("scans")}
        >
          Scans
        </button>
      </div>

      {error ? (
        <div className="notice bad" style={{ marginTop: 12 }}>
          {error}
        </div>
      ) : null}

      {tab === "overview" && (
        <div className="admin-grid" style={{ marginTop: 18 }}>
          <Card className="panel admin-card">
            <div className="admin-metric-grid">
              <div className="admin-metric">
                <div className="admin-metric-label">Total users</div>
                <div className="admin-metric-value">{overview?.total_users ?? "—"}</div>
              </div>
              <div className="admin-metric">
                <div className="admin-metric-label">Active users</div>
                <div className="admin-metric-value">{overview?.total_active_users ?? "—"}</div>
              </div>
              <div className="admin-metric">
                <div className="admin-metric-label">Total scans</div>
                <div className="admin-metric-value">{overview?.total_scans ?? "—"}</div>
              </div>
            </div>
            {overview ? (
              <div className="admin-pill-row" style={{ marginTop: 14 }}>
                <span className="admin-pill">
                  Dashboard scans: {overview.scans_by_type.dashboard}
                </span>
                <span className="admin-pill">
                  Estimate Field scans: {overview.scans_by_type.estimate_field}
                </span>
                <span className="admin-pill">
                  Other scans: {overview.scans_by_type.other}
                </span>
              </div>
            ) : null}
          </Card>

          <Card className="panel admin-card">
            <div className="h3">Scans in last 7 days</div>
            {!overview || maxScanCount === 0 ? (
              <div className="small" style={{ marginTop: 10 }}>
                No scans recorded in the last 7 days.
              </div>
            ) : (
              <div className="admin-chart" style={{ marginTop: 12 }}>
                {overview.scans_last_7_days.map((d) => {
                  const heightPct = maxScanCount ? (d.count / maxScanCount) * 100 : 0;
                  return (
                    <div key={d.date} className="admin-chart-bar">
                      <div className="admin-chart-bar-fill" style={{ height: `${heightPct || 4}%` }} />
                      <div className="admin-chart-label">
                        <span>{new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        <span className="admin-chart-count">{d.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "users" && (
        <Card className="panel admin-card" style={{ marginTop: 18 }}>
          <div className="h2">Users</div>
          <div className="small" style={{ marginTop: 6 }}>
            {users.length} account{users.length === 1 ? "" : "s"} found.
          </div>
          <div className="admin-table" style={{ marginTop: 12 }}>
            <div className="admin-table-head">
              <div>Email</div>
              <div>Username</div>
              <div>Joined</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {users.map((u) => (
              <div key={u.id} className="admin-table-row">
                <div>{u.email}</div>
                <div>{u.username}</div>
                <div>{formatTime(u.created_at)}</div>
                <div>
                  <span className={u.is_active ? "badge-pill ok" : "badge-pill bad"}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="admin-table-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleUserActive(u)}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteUser(u)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "scans" && (
        <Card className="panel admin-card" style={{ marginTop: 18 }}>
          <div className="h2">Scans</div>
          <div className="small" style={{ marginTop: 6 }}>
            {scans.length} scan{scans.length === 1 ? "" : "s"} in database.
          </div>
          <div className="admin-table" style={{ marginTop: 12 }}>
            <div className="admin-table-head">
              <div>ID</div>
              <div>User ID</div>
              <div>Filename</div>
              <div>Created</div>
              <div>Actions</div>
            </div>
            {scans.map((s) => (
              <div key={s.id} className="admin-table-row">
                <div>#{s.id}</div>
                <div>{s.user_id}</div>
                <div title={s.image_filename}>{s.image_filename}</div>
                <div>{formatTime(s.created_at)}</div>
                <div className="admin-table-actions">
                  <a
                    href={s.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link"
                  >
                    View image
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteScan(s)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading && (
        <div className="small" style={{ marginTop: 10 }}>
          Loading admin data…
        </div>
      )}
    </div>
  );
}

async function adminDeleteOrToggleUser(
  token: string,
  user: User,
  _noop: boolean
): Promise<User | null> {
  // Wrapper to keep AdminDashboardPage slimmer; currently just toggles active state.
  const nextActive = !user.is_active;
  const { adminSetUserActive } = await import("../api/api");
  return adminSetUserActive(token, user.id, nextActive);
}
