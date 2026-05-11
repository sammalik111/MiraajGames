"use client";

// Theme + mode picker.
//
// Persistence model:
//   - localStorage holds the most-recent choice for instant first-paint
//     on reload (the boot script in layout.tsx reads it).
//   - For authenticated users, the DB (users.preferred_theme /
//     preferred_mode columns) is the source of truth — fetched once on
//     mount, written on every change.
//   - For anonymous users, only localStorage is touched.
//
// Default for everyone: cyberpunk + OS-preferred mode.

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";

export type ThemeKey =
  | "cyberpunk"
  | "solarpunk"
  | "minimal"
  | "city"
  | "vaporwave"
  | "terminal"
  | "pastel";
type Mode = "light" | "dark";

interface ThemeMeta {
  key: ThemeKey;
  label: string;
  blurb: string;
  // Three-color preview swatch (bg, primary accent, secondary accent).
  // Hardcoded so each card shows its theme regardless of which is active.
  swatch: { bg: string; a: string; b: string };
}

const THEMES: ThemeMeta[] = [
  {
    key: "cyberpunk",
    label: "Cyberpunk",
    blurb: "Neon HUD, sharp corners, scanlines",
    swatch: { bg: "#070b17", a: "#00f0ff", b: "#ff2a6d" },
  },
  {
    key: "solarpunk",
    label: "Solarpunk",
    blurb: "Warm greens, honey, organic curves",
    swatch: { bg: "#faf6e8", a: "#4a9b5d", b: "#d4a017" },
  },
  {
    key: "minimal",
    label: "Minimal",
    blurb: "Clean, restrained, hover-reveal",
    swatch: { bg: "#ffffff", a: "#18181b", b: "#1a73e8" },
  },
  {
    key: "city",
    label: "City at Night",
    blurb: "Navy, streetlamp amber, soft glow",
    swatch: { bg: "#0a1428", a: "#ffaa3b", b: "#ff79c6" },
  },
  {
    key: "vaporwave",
    label: "Vaporwave",
    blurb: "Pink + cyan retrofuture, italics",
    swatch: { bg: "#1a0832", a: "#ff6ec7", b: "#00e6ff" },
  },
  {
    key: "terminal",
    label: "Terminal",
    blurb: "Pure mono on black, ASCII vibes",
    swatch: { bg: "#000000", a: "#33ff33", b: "#aaffaa" },
  },
  {
    key: "pastel",
    label: "Pastel",
    blurb: "Soft, rounded, cozy",
    swatch: { bg: "#fff5f7", a: "#f4a8c1", b: "#a8c8e8" },
  },
];

const VALID_THEMES = new Set(THEMES.map((t) => t.key));

function isThemeKey(s: unknown): s is ThemeKey {
  return typeof s === "string" && VALID_THEMES.has(s as ThemeKey);
}

function readCurrent(): { theme: ThemeKey; mode: Mode } {
  if (typeof document === "undefined") return { theme: "cyberpunk", mode: "light" };
  const t = document.documentElement.getAttribute("data-theme");
  const theme = isThemeKey(t) ? t : "cyberpunk";
  const mode: Mode = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  return { theme, mode };
}

function applyTheme(t: ThemeKey) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem("theme", t);
  } catch {}
}

function applyMode(m: Mode) {
  document.documentElement.classList.toggle("dark", m === "dark");
  try {
    localStorage.setItem("mode", m);
  } catch {}
}

interface PickerProps {
  mode?: "popover" | "inline";
}

export default function ThemePicker({
  mode: pickerMode = "inline",
}: PickerProps = {}) {
  const { authed } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeKey>("cyberpunk");
  const [mode, setMode] = useState<Mode>("light");
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // First paint comes from the boot script which has already set the
  // attribute. Sync local state from there.
  useEffect(() => {
    const cur = readCurrent();
    setTheme(cur.theme);
    setMode(cur.mode);
    setMounted(true);
  }, []);

  // Once authed, fetch the DB-backed preference. If it differs from
  // what's currently applied (localStorage cache), apply the DB value —
  // it's the source of truth for cross-device consistency.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/theme", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          theme: string | null;
          mode: string | null;
        };
        if (data.theme && isThemeKey(data.theme)) {
          setTheme(data.theme);
          applyTheme(data.theme);
        }
        if (data.mode === "light" || data.mode === "dark") {
          setMode(data.mode);
          applyMode(data.mode);
        }
      } catch {
        /* network blip — keep the localStorage value */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  // Outside-click + Escape close the popover variant.
  useEffect(() => {
    if (!open || pickerMode !== "popover") return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, pickerMode]);

  // Single mutation path — applies locally + writes through to DB if
  // the user is logged in. Errors don't roll back the local change;
  // localStorage at least keeps it across reloads on this device.
  const persist = async (next: { theme?: ThemeKey; mode?: Mode }) => {
    if (!authed) return;
    setSaving(true);
    try {
      await fetch("/api/auth/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {
      /* swallow — local applied already */
    } finally {
      setSaving(false);
    }
  };

  const pickTheme = (t: ThemeKey) => {
    setTheme(t);
    applyTheme(t);
    persist({ theme: t });
  };
  const pickMode = (m: Mode) => {
    setMode(m);
    applyMode(m);
    persist({ mode: m });
  };

  if (!mounted) {
    return pickerMode === "inline" ? (
      <div className="h-64 border border-[color:var(--border)]" />
    ) : (
      <div
        className="hud-clip border border-[color:var(--border-strong)]"
        style={{ width: 36, height: 36 }}
      />
    );
  }

  // ---- Inline rendering --------------------------------------------
  if (pickerMode === "inline") {
    return (
      <div className="space-y-6">
        {/* Theme grid — three columns on wide screens, scales down */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
              Theme
            </p>
            {authed ? (
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                {saving ? "Saving…" : "Synced to your account"}
              </p>
            ) : (
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                Sign in to sync across devices
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {THEMES.map((t) => {
              const active = t.key === theme;
              return (
                <button
                  key={t.key}
                  onClick={() => pickTheme(t.key)}
                  role="radio"
                  aria-checked={active}
                  className={`text-left p-3 border transition flex flex-col gap-3 ${
                    active
                      ? "border-[color:var(--neon-cyan)] bg-[color:var(--neon-cyan)]/8"
                      : "border-[color:var(--border)] hover:border-[color:var(--neon-cyan)]"
                  }`}
                >
                  <div
                    className="h-16 w-full border border-[color:var(--border)]"
                    style={{
                      background: `linear-gradient(90deg, ${t.swatch.bg} 0%, ${t.swatch.bg} 50%, ${t.swatch.a} 50%, ${t.swatch.a} 75%, ${t.swatch.b} 75%, ${t.swatch.b} 100%)`,
                    }}
                    aria-hidden
                  />
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--fg)]">
                      {t.label}
                    </p>
                    <p className="font-mono text-[10px] text-[color:var(--fg-muted)] mt-1 leading-relaxed">
                      {t.blurb}
                    </p>
                  </div>
                  {active && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--neon-cyan)]">
                      ✓ Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode toggle */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] mb-2">
            Mode
          </p>
          <div className="grid grid-cols-2 max-w-xs border border-[color:var(--border)]">
            {(["light", "dark"] as Mode[]).map((m) => {
              const active = m === mode;
              return (
                <button
                  key={m}
                  onClick={() => pickMode(m)}
                  role="radio"
                  aria-checked={active}
                  className={`py-3 font-mono text-xs uppercase tracking-[0.22em] transition ${
                    active
                      ? "bg-[color:var(--neon-cyan)] text-black"
                      : "text-[color:var(--fg)] hover:bg-[color:var(--neon-cyan)]/10"
                  }`}
                >
                  {m === "light" ? "☀ Light" : "☾ Dark"}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---- Popover (compact) variant -----------------------------------
  const activeMeta = THEMES.find((t) => t.key === theme) ?? THEMES[0];
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Theme picker"
        aria-expanded={open}
        className="hud-clip h-9 w-9 border border-[color:var(--border-strong)] hover:border-[color:var(--neon-cyan)] transition relative overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${activeMeta.swatch.bg} 0%, ${activeMeta.swatch.bg} 33%, ${activeMeta.swatch.a} 33%, ${activeMeta.swatch.a} 66%, ${activeMeta.swatch.b} 66%, ${activeMeta.swatch.b} 100%)`,
            opacity: 0.85,
          }}
        />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 border border-[color:var(--border-strong)] bg-[color:var(--surface)] z-50 p-3 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]">
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {THEMES.map((t) => {
              const active = t.key === theme;
              return (
                <button
                  key={t.key}
                  onClick={() => pickTheme(t.key)}
                  className={`text-left p-2 border transition ${active ? "border-[color:var(--neon-cyan)]" : "border-[color:var(--border)]"}`}
                >
                  <div
                    className="h-8 w-full mb-1 border border-[color:var(--border)]"
                    style={{
                      background: `linear-gradient(90deg, ${t.swatch.bg} 0%, ${t.swatch.bg} 50%, ${t.swatch.a} 50%, ${t.swatch.a} 75%, ${t.swatch.b} 75%, ${t.swatch.b} 100%)`,
                    }}
                  />
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--fg)]">
                    {t.label}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 border border-[color:var(--border)]">
            {(["light", "dark"] as Mode[]).map((m) => {
              const active = m === mode;
              return (
                <button
                  key={m}
                  onClick={() => pickMode(m)}
                  className={`py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition ${active ? "bg-[color:var(--neon-cyan)] text-black" : "text-[color:var(--fg)] hover:bg-[color:var(--neon-cyan)]/10"}`}
                >
                  {m === "light" ? "☀ Light" : "☾ Dark"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
