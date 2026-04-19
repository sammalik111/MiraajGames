"use client";

import React, { useEffect, useRef, useState } from "react";

const TABLE_W = 320;
const TABLE_H = 192;
const BALL_R = 10;
const FRICTION = 0.985;
const MIN_SPEED = 0.05;

type Ball = { x: number; y: number; dx: number; dy: number; color: string; id: number; potted: boolean };

const POCKETS = [
  { x: 12, y: 12 }, { x: TABLE_W / 2, y: 8 }, { x: TABLE_W - 12, y: 12 },
  { x: 12, y: TABLE_H - 12 }, { x: TABLE_W / 2, y: TABLE_H - 8 }, { x: TABLE_W - 12, y: TABLE_H - 12 },
];
const POCKET_R = 14;

const startBalls = (): Ball[] => {
  const balls: Ball[] = [{ id: 0, x: 80, y: TABLE_H / 2, dx: 0, dy: 0, color: "#ffffff", potted: false }];
  const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899", "#eab308"];
  let id = 1;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col <= row; col++) {
      balls.push({
        id: id,
        x: 220 + row * (BALL_R * 2 + 1),
        y: TABLE_H / 2 - row * BALL_R + col * (BALL_R * 2 + 1),
        dx: 0, dy: 0,
        color: colors[(id - 1) % colors.length],
        potted: false,
      });
      id++;
    }
  }
  return balls;
};

export default function PoolGame() {
  const [balls, setBalls] = useState<Ball[]>(startBalls);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [power, setPower] = useState(6);
  const [shots, setShots] = useState(0);
  const [message, setMessage] = useState("Click the table to aim, then Shoot.");
  const ballsRef = useRef(balls);
  ballsRef.current = balls;

  useEffect(() => {
    const tick = window.setInterval(() => {
      setBalls((prev) => {
        const next = prev.map((b) => ({ ...b }));
        for (const b of next) {
          if (b.potted) continue;
          b.x += b.dx;
          b.y += b.dy;
          if (b.x < BALL_R) { b.x = BALL_R; b.dx = -b.dx * 0.9; }
          if (b.x > TABLE_W - BALL_R) { b.x = TABLE_W - BALL_R; b.dx = -b.dx * 0.9; }
          if (b.y < BALL_R) { b.y = BALL_R; b.dy = -b.dy * 0.9; }
          if (b.y > TABLE_H - BALL_R) { b.y = TABLE_H - BALL_R; b.dy = -b.dy * 0.9; }
          b.dx *= FRICTION;
          b.dy *= FRICTION;
          if (Math.abs(b.dx) < MIN_SPEED) b.dx = 0;
          if (Math.abs(b.dy) < MIN_SPEED) b.dy = 0;
          for (const p of POCKETS) {
            const d = Math.hypot(b.x - p.x, b.y - p.y);
            if (d < POCKET_R) { b.potted = true; b.dx = 0; b.dy = 0; }
          }
        }
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i], c = next[j];
            if (a.potted || c.potted) continue;
            const dx = c.x - a.x, dy = c.y - a.y;
            const dist = Math.hypot(dx, dy);
            if (dist < BALL_R * 2 && dist > 0) {
              const nx = dx / dist, ny = dy / dist;
              const overlap = BALL_R * 2 - dist;
              a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
              c.x += nx * overlap / 2; c.y += ny * overlap / 2;
              const kx = a.dx - c.dx, ky = a.dy - c.dy;
              const dot = kx * nx + ky * ny;
              if (dot > 0) {
                a.dx -= dot * nx; a.dy -= dot * ny;
                c.dx += dot * nx; c.dy += dot * ny;
              }
            }
          }
        }
        return next;
      });
    }, 16);
    return () => window.clearInterval(tick);
  }, []);

  const onTableClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setAim({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const shoot = () => {
    if (!aim) { setMessage("Click the table first to aim."); return; }
    const cue = ballsRef.current.find((b) => b.id === 0);
    if (!cue || cue.potted) { setMessage("Cue ball is not in play."); return; }
    const moving = ballsRef.current.some((b) => !b.potted && (Math.abs(b.dx) > 0 || Math.abs(b.dy) > 0));
    if (moving) { setMessage("Wait for balls to stop."); return; }
    const dx = aim.x - cue.x, dy = aim.y - cue.y;
    const d = Math.hypot(dx, dy) || 1;
    setBalls((prev) => prev.map((b) => b.id === 0 ? { ...b, dx: (dx / d) * power, dy: (dy / d) * power } : b));
    setShots((s) => s + 1);
    setMessage("Shot!");
  };

  const reset = () => {
    setBalls(startBalls());
    setShots(0);
    setAim(null);
    setMessage("New rack set up.");
  };

  const potted = balls.filter((b) => b.potted && b.id !== 0).length;

  return (
    <div className="space-y-6 w-full max-w-2xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">8 Ball Pool</h2>
        <p className="mt-2 text-slate-400">Click the table to aim, press Shoot to hit the cue ball. Sink balls into pockets.</p>
      </div>

      <div
        onClick={onTableClick}
        className="relative mx-auto cursor-crosshair rounded-[1.5rem] border-4 border-amber-900 bg-green-700 shadow-inner"
        style={{ width: TABLE_W, height: TABLE_H }}
      >
        {POCKETS.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-black"
            style={{ left: p.x - POCKET_R, top: p.y - POCKET_R, width: POCKET_R * 2, height: POCKET_R * 2 }}
          />
        ))}
        {balls.filter(b => !b.potted).map((b) => (
          <div
            key={b.id}
            className="absolute rounded-full shadow"
            style={{
              left: b.x - BALL_R, top: b.y - BALL_R,
              width: BALL_R * 2, height: BALL_R * 2,
              background: b.color,
              border: b.id === 0 ? "1px solid #ddd" : "1px solid rgba(0,0,0,0.3)",
            }}
          />
        ))}
        {aim && !balls.find(b => b.id === 0)?.potted && (() => {
          const cue = balls.find(b => b.id === 0)!;
          return (
            <svg className="absolute inset-0 pointer-events-none" width={TABLE_W} height={TABLE_H}>
              <line x1={cue.x} y1={cue.y} x2={aim.x} y2={aim.y} stroke="rgba(255,255,255,0.7)" strokeDasharray="3 3" />
            </svg>
          );
        })()}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <button
          onClick={shoot}
          className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          Shoot
        </button>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          <label className="block text-slate-400">Power: {power.toFixed(1)}</label>
          <input
            type="range" min={2} max={14} step={0.5}
            value={power} onChange={(e) => setPower(+e.target.value)}
            className="w-full"
          />
        </div>
        <button
          onClick={reset}
          className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          Rack Again
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
        <p>Shots: {shots} &middot; Potted: {potted}</p>
        <p className="mt-1 text-slate-400">{message}</p>
      </div>
    </div>
  );
}