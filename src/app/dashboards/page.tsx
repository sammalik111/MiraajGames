"use client";

// Admin dashboard. Gated by /api/admin/Dashboards which checks the
// caller against process.env.ADMIN_IDS server-side. Non-admins get a 403
// from the API and we render a "forbidden" state.
//
// Sections:
//   1. Stats grid     — counts pulled from the DB in a single round trip
//   2. Feedback list  — every feedback row, newest first
//   3. Users list     — every account, with a delete button
//   4. CloudWatch     — placeholder block until the user wires it up
//
// To add a new dashboard panel: add a section to the GET payload in
// /api/admin/Dashboards/route.ts and a corresponding block here.

import Navbar from "@/components/navbar";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface MetricPoint { t: number; v: number }
interface MetricSeries {
  key: string;
  label: string;
  metricName: string;
  unit: string;
  statistic: string;
  points: MetricPoint[];
  latest: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
}
interface CloudWatchPayload {
  instanceId: string;
  region?: string;
  assumedRole: string | null;
  windowHours: number;
  period: number;
  generatedAt: string;
  metrics: MetricSeries[];
}

interface Stats {
  users: { total: number; newLast7Days: number };
  feedback: { total: number };
  games: {
    scoresSubmitted: number;
    sessionsTotal: number;
    sessionsActive: number;
  };
  messages: { total: number; conversations: number };
}

interface FeedbackRow {
  id: string;
  createdBy: string | null;
  submitterName: string | null;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

interface UserRow {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface DashboardData {
  stats: Stats;
  feedback: FeedbackRow[];
  users: UserRow[];
  currentAdminId: string;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString();
}

export default function DashboardsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [cw, setCw] = useState<CloudWatchPayload | null>(null);
  const [cwError, setCwError] = useState<string | null>(null);
  const [cwLoading, setCwLoading] = useState(false);
  const [cwHours, setCwHours] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Dashboard payload + CloudWatch metrics fire in PARALLEL on mount.
  // No need to chain them — they hit different endpoints with different
  // latency profiles (CloudWatch is slower because it does N upstream
  // calls).
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/Dashboards", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const raw = await res.text();
        setError(`Failed to load (${res.status}): ${raw.slice(0, 200)}`);
        return;
      }
      const payload = (await res.json()) as DashboardData;
      setData(payload);
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCloudWatch = useCallback(async (hours: number) => {
    setCwLoading(true);
    setCwError(null);
    try {
      const res = await fetch(
        `/api/admin/cloudwatchMetrics?hours=${hours}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const raw = await res.text();
        let msg = raw;
        try {
          msg = JSON.parse(raw)?.error ?? raw;
        } catch {}
        setCwError(`${res.status}: ${msg.slice(0, 200)}`);
        return;
      }
      setCw((await res.json()) as CloudWatchPayload);
    } catch (e) {
      setCwError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCwLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    refreshCloudWatch(cwHours);
    // intentionally only fire on mount; window changes re-fire below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch CloudWatch whenever the user picks a different window.
  useEffect(() => {
    refreshCloudWatch(cwHours);
  }, [cwHours, refreshCloudWatch]);

  const deleteUser = async (id: string) => {
    if (deletingId) return;
    setActionError(null);
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/admin/Dashboards?userId=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const raw = await res.text();
        setActionError(`Delete failed (${res.status}): ${raw.slice(0, 200)}`);
        return;
      }
      // Optimistic local update — remove the row from state without
      // re-fetching the whole payload. Saves a round trip.
      setData((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.filter((u) => u.id !== id),
              stats: {
                ...prev.stats,
                users: {
                  ...prev.stats.users,
                  total: prev.stats.users.total - 1,
                },
              },
            }
          : prev,
      );
    } catch (e) {
      setActionError(
        `Network error: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ---- Forbidden / loading / error states -----------------------------
  if (forbidden) {
    return (
      <div className="min-h-screen text-[color:var(--fg)]">
        <Navbar />
        <main className="relative z-10 max-w-2xl mx-auto px-4 py-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
            ✕ Access denied
          </p>
          <h1 className="mt-3 font-display font-black text-4xl sm:text-5xl tracking-tight">
            ADMIN ONLY
          </h1>
          <p className="mt-4 text-[color:var(--fg-muted)]">
            Your account isn&apos;t in the admin allow-list.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex font-mono text-xs uppercase tracking-[0.2em] px-5 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
          >
            ← Back to Arcade
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
            ┌─ Operator Console
          </p>
          <h1 className="font-display font-black text-4xl sm:text-5xl mt-3 tracking-tight">
            <span className="text-[color:var(--fg)]">DASHBOARDS</span>
            <span className="text-[color:var(--neon-magenta)] dark:glow-magenta">_</span>
          </h1>
          <p className="text-sm text-[color:var(--fg-muted)] mt-2 max-w-lg">
            Admin-only metrics, feedback, and user management. Pulled live
            from the database on each load.
          </p>
        </div>

        {error && (
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
            ✕ {error}
          </p>
        )}

        {loading && !data ? (
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            <span className="blink">●</span> Loading...
          </p>
        ) : data ? (
          <>
            {/* ---------- STATS GRID ---------- */}
            <section>
              <div className="flex items-end justify-between pb-3 border-b border-[color:var(--border)]">
                <h2 className="font-display font-bold text-2xl">Stats</h2>
                <button
                  onClick={refresh}
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-cyan)] transition"
                >
                  ↻ Refresh
                </button>
              </div>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Users"
                  value={data.stats.users.total}
                  subtext={`+${data.stats.users.newLast7Days} this week`}
                  accent="cyan"
                />
                <StatCard
                  label="Feedback"
                  value={data.stats.feedback.total}
                  subtext="all-time submissions"
                  accent="magenta"
                />
                <StatCard
                  label="Game Scores"
                  value={data.stats.games.scoresSubmitted}
                  subtext="audit log entries"
                  accent="yellow"
                />
                <StatCard
                  label="Active Rooms"
                  value={data.stats.games.sessionsActive}
                  subtext={`of ${data.stats.games.sessionsTotal} total`}
                  accent="lime"
                />
                <StatCard
                  label="Messages"
                  value={data.stats.messages.total}
                  subtext={`across ${data.stats.messages.conversations} channels`}
                  accent="cyan"
                />
              </div>
            </section>

            {/* ---------- CLOUDWATCH ---------- */}
            <section>
              <div className="flex flex-wrap items-end justify-between gap-3 pb-3 border-b border-[color:var(--border)]">
                <div>
                  <h2 className="font-display font-bold text-2xl">
                    EC2 / CloudWatch
                  </h2>
                  <p className="text-sm text-[color:var(--fg-muted)] mt-1">
                    {cw?.instanceId ? (
                      <>
                        Live metrics from{" "}
                        <span className="text-[color:var(--neon-cyan)] normal-case tracking-normal">
                          {cw.instanceId}
                        </span>
                        {cw.region && (
                          <>
                            {" · "}
                            <span className="text-[color:var(--fg-muted)]">
                              {cw.region}
                            </span>
                          </>
                        )}
                        {cw.assumedRole && (
                          <>
                            {" · "}
                            <span className="text-[color:var(--neon-lime)]">
                              role-assumed
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      "EC2 instance metrics from CloudWatch."
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Window selector */}
                  <div className="flex border border-[color:var(--border)]">
                    {[1, 6, 24, 168].map((h) => (
                      <button
                        key={h}
                        onClick={() => setCwHours(h)}
                        className={`font-mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 transition ${
                          cwHours === h
                            ? "bg-[color:var(--neon-cyan)] text-black"
                            : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
                        }`}
                      >
                        {h === 1
                          ? "1h"
                          : h === 6
                            ? "6h"
                            : h === 24
                              ? "24h"
                              : "7d"}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => refreshCloudWatch(cwHours)}
                    disabled={cwLoading}
                    className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-cyan)] transition px-2 py-1.5 disabled:opacity-40"
                  >
                    {cwLoading ? "..." : "↻"}
                  </button>
                </div>
              </div>

              {cwError ? (
                <div className="mt-4 border border-dashed border-[color:var(--neon-magenta)] py-6 px-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
                    ✕ CloudWatch fetch failed
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--fg-muted)] font-mono break-words">
                    {cwError}
                  </p>
                  <p className="mt-3 text-xs text-[color:var(--fg-muted)]">
                    Check that AWS_REGION, AWS_ACCESS_KEY_ID,
                    AWS_SECRET_ACCESS_KEY and EC2_INSTANCE_ID are set in
                    env. If you&apos;re using a role, also set AWS_ROLE_ARN.
                  </p>
                </div>
              ) : cw ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cw.metrics.map((m) => (
                    <MetricCard key={m.key} m={m} />
                  ))}
                </div>
              ) : (
                <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                  <span className="blink">●</span> Fetching CloudWatch...
                </p>
              )}
            </section>

            {/* ---------- FEEDBACK ---------- */}
            <section>
              <div className="flex items-end justify-between pb-3 border-b border-[color:var(--border)]">
                <div>
                  <h2 className="font-display font-bold text-2xl">Feedback</h2>
                  <p className="text-sm text-[color:var(--fg-muted)] mt-1">
                    {data.feedback.length} submissions, newest first.
                  </p>
                </div>
              </div>
              {data.feedback.length === 0 ? (
                <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                  &gt; No feedback submitted yet.
                </p>
              ) : (
                <ul className="mt-6 space-y-3">
                  {data.feedback.map((f) => (
                    <li
                      key={f.id}
                      className="border border-[color:var(--border)] p-4 hover:border-[color:var(--neon-cyan)] transition"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                        <h3 className="font-display font-bold text-base text-[color:var(--fg)]">
                          {f.subject || "(no subject)"}
                        </h3>
                        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                          {formatDate(f.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-[color:var(--fg-muted)] whitespace-pre-wrap leading-relaxed">
                        {f.message}
                      </p>
                      <div className="mt-3 pt-3 border-t border-[color:var(--border)] flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                        <span>
                          From{" "}
                          <span className="text-[color:var(--neon-cyan)] normal-case tracking-normal">
                            {f.submitterName ?? "Unknown"}
                          </span>
                        </span>
                        <span>·</span>
                        <span className="normal-case tracking-normal">
                          {f.email}
                        </span>
                        {f.createdBy && (
                          <>
                            <span>·</span>
                            <Link
                              href={`/profile/${f.createdBy}`}
                              className="hover:text-[color:var(--neon-cyan)]"
                            >
                              View profile →
                            </Link>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ---------- USERS ---------- */}
            <section>
              <div className="flex items-end justify-between pb-3 border-b border-[color:var(--border)]">
                <div>
                  <h2 className="font-display font-bold text-2xl">Users</h2>
                  <p className="text-sm text-[color:var(--fg-muted)] mt-1">
                    {data.users.length} accounts. Deleting cascades through
                    favorites, friends, scores, and feedback rows.
                  </p>
                </div>
              </div>

              {actionError && (
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
                  ✕ {actionError}
                </p>
              )}

              <div className="mt-6 border border-[color:var(--border)] divide-y divide-[color:var(--border)]">
                {data.users.map((u) => {
                  const isMe = u.id === data.currentAdminId;
                  const display = u.nickname || u.name || u.email;
                  return (
                    <div
                      key={u.id}
                      className="flex items-center gap-4 px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-sm text-[color:var(--fg)] truncate">
                          {display}
                          {isMe && (
                            <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] mt-0.5 truncate">
                          {u.email} · joined {formatDate(u.createdAt)}
                        </p>
                        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] mt-0.5 normal-case tracking-normal truncate">
                          id :: {u.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link
                          href={`/profile/${u.id}`}
                          className="font-mono text-[10px] uppercase tracking-[0.22em] px-2 py-1 border border-[color:var(--border)] hover:border-[color:var(--neon-cyan)] transition"
                        >
                          View
                        </Link>
                        <DeleteButton
                          disabled={isMe}
                          busy={deletingId === u.id}
                          onConfirm={() => deleteUser(u.id)}
                          label={display}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string;
  value: number | string;
  subtext: string;
  accent: "cyan" | "magenta" | "yellow" | "lime";
}) {
  return (
    <div className="border border-[color:var(--border)] p-4 hover:border-[color:var(--neon-cyan)] transition">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        {label}
      </p>
      <p
        className={`font-display font-black text-3xl mt-1 tabular-nums text-${accent} dark:glow-${accent}`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--fg-muted)] mt-1">
        {subtext}
      </p>
    </div>
  );
}

// Two-step delete: first click arms the button, second confirms. Avoids
// accidental clicks on a destructive action without needing a modal.
function DeleteButton({
  disabled,
  busy,
  onConfirm,
  label,
}: {
  disabled: boolean;
  busy: boolean;
  onConfirm: () => void;
  label: string;
}) {
  const [armed, setArmed] = useState(false);

  // Auto-disarm after 4 seconds so the button doesn't stay in the
  // dangerous state forever.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  if (disabled) {
    return (
      <button
        disabled
        title="You can't delete your own admin account here."
        className="font-mono text-[10px] uppercase tracking-[0.22em] px-2 py-1 border border-[color:var(--border)] text-[color:var(--fg-muted)] opacity-40 cursor-not-allowed"
      >
        Delete
      </button>
    );
  }

  if (armed) {
    return (
      <button
        onClick={onConfirm}
        disabled={busy}
        title={`Permanently delete ${label}`}
        className="font-mono text-[10px] uppercase tracking-[0.22em] px-2 py-1 bg-[color:var(--neon-magenta)] text-black hover:brightness-110 transition disabled:opacity-50"
      >
        {busy ? "..." : "Confirm?"}
      </button>
    );
  }

  return (
    <button
      onClick={() => setArmed(true)}
      className="font-mono text-[10px] uppercase tracking-[0.22em] px-2 py-1 border border-[color:var(--neon-magenta)] text-[color:var(--neon-magenta)] hover:bg-[color:var(--neon-magenta)]/10 transition"
    >
      Delete
    </button>
  );
}

// ---------------------------------------------------------------------------
// CloudWatch metric card: label, latest value, sparkline, min/max/avg.
// Each card is self-contained — pass it the series object and it renders
// everything from there.
// ---------------------------------------------------------------------------
function MetricCard({ m }: { m: MetricSeries }) {
  const { label, unit, latest, min, max, avg, points } = m;

  const fmt = (v: number | null): string => {
    if (v == null || Number.isNaN(v)) return "—";
    if (unit === "Bytes") {
      // Format as KB / MB / GB depending on magnitude.
      const abs = Math.abs(v);
      if (abs > 1e9) return `${(v / 1e9).toFixed(2)} GB`;
      if (abs > 1e6) return `${(v / 1e6).toFixed(2)} MB`;
      if (abs > 1e3) return `${(v / 1e3).toFixed(2)} KB`;
      return `${v.toFixed(0)} B`;
    }
    if (unit === "Percent") return `${v.toFixed(1)}%`;
    if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return v.toFixed(2);
  };

  // Color cue: red if status-check-failed > 0, otherwise theme accent.
  const isAlarm = m.key === "statusCheckFailed" && (latest ?? 0) > 0;
  const accent = isAlarm ? "var(--neon-magenta)" : "var(--neon-cyan)";

  return (
    <div className="border border-[color:var(--border)] p-4 hover:border-[color:var(--neon-cyan)] transition">
      <div className="flex items-baseline justify-between mb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
          {label}
        </p>
        <p
          className="font-mono text-[9px] uppercase tracking-[0.22em]"
          style={{ color: "var(--fg-muted)" }}
        >
          {m.statistic}
        </p>
      </div>
      <p
        className="font-display font-black text-2xl tabular-nums"
        style={{ color: accent }}
      >
        {fmt(latest)}
      </p>
      <div className="mt-3">
        <Sparkline points={points} stroke={accent} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">
        <div>
          <span className="block">min</span>
          <span className="text-[color:var(--fg)] normal-case tracking-normal">{fmt(min)}</span>
        </div>
        <div>
          <span className="block">avg</span>
          <span className="text-[color:var(--fg)] normal-case tracking-normal">{fmt(avg)}</span>
        </div>
        <div>
          <span className="block">max</span>
          <span className="text-[color:var(--fg)] normal-case tracking-normal">{fmt(max)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG sparkline. No charting library — for a 12-72 point series
// the math is tiny and shipping recharts/d3 for this would be massive
// overkill. Stroke + fill are independent so a flat baseline is drawn
// to anchor empty-ish series.
// ---------------------------------------------------------------------------
function Sparkline({
  points,
  stroke,
}: {
  points: MetricPoint[];
  stroke: string;
}) {
  const w = 240;
  const h = 48;
  if (points.length === 0) {
    return (
      <div
        className="w-full h-12 border border-dashed border-[color:var(--border)] flex items-center justify-center"
        style={{ width: "100%", height: h }}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
          no data
        </span>
      </div>
    );
  }
  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const tRange = maxT - minT || 1;
  const vs = points.map((p) => p.v);
  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);
  const vRange = maxV - minV || 1;

  // Build the path string + a filled area below it.
  const xy = points.map((p) => {
    const x = ((p.t - minT) / tRange) * w;
    const y = h - ((p.v - minV) / vRange) * (h - 2) - 1;
    return [x, y] as const;
  });
  const linePath = xy
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${xy[xy.length - 1][0].toFixed(2)} ${h} L ${xy[0][0].toFixed(2)} ${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      width="100%"
      height={h}
      style={{ display: "block" }}
    >
      <path d={areaPath} fill={stroke} fillOpacity={0.12} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}
