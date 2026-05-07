"use client";

// Theme + mode picker.
//
// Two independent settings, both persisted in localStorage:
//   theme : cyberpunk | solarpunk | minimal | city
//   mode  : light | dark
//
// All four themes have light AND dark variants, so they're orthogonal —
// you can run a solarpunk dark or a city light. The picker is a small
// circular icon button that opens a popover with theme cards and a
// light/dark pill at the bottom.

import { useEffect, useRef, useState } from "react";

type ThemeKey = "cyberpunk" | "solarpunk" | "minimal" | "city";
type Mode = "light" | "dark";

interface ThemeMeta {
  key: ThemeKey;
  label: string;
  blurb: string;
  // Three-color preview swatch — bg, accent, secondary
  swatch: { bg: string; a: string; b: string };
}

// Hardcoded preview colors so we don't have to read CSS vars at render
// time (the popover renders against the CURRENT theme; the swatches need
// to show what each theme looks like regardless).
const THEMES: ThemeMeta[] = [
  {
    key: "cyberpunk",
    label: "Cyberpunk",
    blurb: "Neon HUD, sharp corners",
    swatch: { bg: "#070b17", a: "#00f0ff", b: "#ff2a6d" },
  },
  {
    key: "solarpunk",
    label: "Solarpunk",
    blurb: "Greens, honey, organic",
    swatch: { bg: "#faf6e8", a: "#4a9b5d", b: "#d4a017" },
  },
  {
    key: "minimal",
    label: "Minimal",
    blurb: "Clean, restrained",
    swatch: { bg: "#ffffff", a: "#18181b", b: "#1a73e8" },
  },
  {
    key: "city",
    label: "City at Night",
    blurb: "Navy, streetlamp amber",
    swatch: { bg: "#0a1428", a: "#ffaa3b", b: "#ff79c6" },
  },
];

function readCurrent(): { theme: ThemeKey; mode: Mode } {
  if (typeof document === "undefined") return { theme: "cyberpunk", mode: "light" };
  const t = (document.documentElement.getAttribute("data-theme") as ThemeKey) || "cyberpunk";
  const m: Mode = document.documentElement.classList.contains("dark") ? "dark" : "light";
  return { theme: t, mode: m };
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
  // "popover" → small icon button that opens a dropdown (used in navbar
  //              previously; still available if you want it back).
  // "inline"  → renders the cards directly, no toggle. Used in the
  //              profile page's Appearance section.
  mode?: "popover" | "inline";
}

export default function ThemePicker({ mode: pickerMode = "popover" }: PickerProps = {}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeKey>("cyberpunk");
  const [mode, setMode] = useState<Mode>("light");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Read the state set by the no-flash boot script.
  useEffect(() => {
    const cur = readCurrent();
    setTheme(cur.theme);
    setMode(cur.mode);
    setMounted(true);
  }, []);

  // Outside-click + Escape close.
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const pickTheme = (t: ThemeKey) => {
    setTheme(t);
    applyTheme(t);
  };
  const pickMode = (m: Mode) => {
    setMode(m);
    applyMode(m);
  };

  // Skeleton during SSR/hydration so the layout doesn't jump.
  if (!mounted) {
    return pickerMode === "inline" ? (
      <div className="h-48 border border-[color:var(--border)]" />
    ) : (
      <div
        className="hud-clip border border-[color:var(--border-strong)]"
        style={{ width: 36, height: 36 }}
      />
    );
  }

  const activeMeta = THEMES.find((t) => t.key === theme) ?? THEMES[0];

  // ---- Inline rendering: cards laid out flat for a settings panel -----
  if (pickerMode === "inline") {
    return (
      <div className="space-y-5">
        {/* Theme grid */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] mb-3">
            Theme
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  {/* Larger preview swatch */}
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
  // ---- Popover rendering (legacy navbar usage) ----

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Theme picker"
        aria-expanded={open}
        title="Theme picker"
        className="hud-clip h-9 w-9 border border-[color:var(--border-strong)] hover:border-[color:var(--neon-cyan)] transition flex items-center justify-center relative overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        {/* Three diagonal swatch stripes hint at the active theme */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${activeMeta.swatch.bg} 0%, ${activeMeta.swatch.bg} 33%, ${activeMeta.swatch.a} 33%, ${activeMeta.swatch.a} 66%, ${activeMeta.swatch.b} 66%, ${activeMeta.swatch.b} 100%)`,
            opacity: 0.85,
          }}
        />
        {/* Mode glyph layered on top */}
        <span className="relative z-10 text-[color:var(--fg)] mix-blend-difference">
          {mode === "dark" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          )}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 origin-top-right border border-[color:var(--border-strong)] bg-[color:var(--surface)] shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]"
          style={{
            animation: "menuOpen 160ms ease-out",
          }}
        >
          <style jsx>{`
            @keyframes menuOpen {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div className="px-4 py-2 border-b border-[color:var(--border)] bg-[color:var(--surface-2)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--neon-cyan)]">
              ▸ Theme
            </p>
          </div>

          <div className="p-2 grid grid-cols-2 gap-2">
            {THEMES.map((t) => {
              const active = t.key === theme;
              return (
                <button
                  key={t.key}
                  onClick={() => pickTheme(t.key)}
                  role="menuitemradio"
                  aria-checked={active}
                  className={`text-left p-2 border transition flex flex-col gap-2 ${
                    active
                      ? "border-[color:var(--neon-cyan)] bg-[color:var(--neon-cyan)]/8"
                      : "border-[color:var(--border)] hover:border-[color:var(--neon-cyan)]"
                  }`}
                >
                  {/* Swatch preview — 3 vertical stripes showing the theme palette */}
                  <div
                    className="h-10 w-full border border-[color:var(--border)]"
                    style={{
                      background: `linear-gradient(90deg, ${t.swatch.bg} 0%, ${t.swatch.bg} 50%, ${t.swatch.a} 50%, ${t.swatch.a} 75%, ${t.swatch.b} 75%, ${t.swatch.b} 100%)`,
                    }}
                    aria-hidden
                  />
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--fg)]">
                      {t.label}
                    </p>
                    <p className="font-mono text-[9px] text-[color:var(--fg-muted)] mt-0.5 truncate">
                      {t.blurb}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 pb-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] mb-1.5">
              Mode
            </p>
            <div className="grid grid-cols-2 border border-[color:var(--border)]">
              {(["light", "dark"] as Mode[]).map((m) => {
                const active = m === mode;
                return (
                  <button
                    key={m}
                    onClick={() => pickMode(m)}
                    role="menuitemradio"
                    aria-checked={active}
                    className={`py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition ${
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
      )}
    </div>
  );
}
