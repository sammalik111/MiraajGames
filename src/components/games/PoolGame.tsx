"use client";

import React, { useEffect, useRef, useState } from "react";

export default function PoolGame() {
  const [ball, setBall] = useState({ x: 160, y: 90 });
  const velocityRef = useRef({ dx: 0, dy: 0 });
  const [shots, setShots] = useState(0);
  const [message, setMessage] = useState("Tap shoot to send the cue ball.");

  useEffect(() => {
    const tick = window.setInterval(() => {
      setBall((prev) => {
        let nextX = prev.x + velocityRef.current.dx;
        let nextY = prev.y + velocityRef.current.dy;
        let nextDx = velocityRef.current.dx;
        let nextDy = velocityRef.current.dy;

        if (nextX < 16 || nextX > 284) {
          nextDx *= -0.75;
          nextX = Math.min(Math.max(nextX, 16), 284);
        }
        if (nextY < 16 || nextY > 164) {
          nextDy *= -0.75;
          nextY = Math.min(Math.max(nextY, 16), 164);
        }

        if (Math.abs(nextDx) < 0.05) nextDx = 0;
        if (Math.abs(nextDy) < 0.05) nextDy = 0;

        velocityRef.current = { dx: nextDx * 0.98, dy: nextDy * 0.98 };
        return { x: nextX, y: nextY };
      });
    }, 24);

    return () => window.clearInterval(tick);
  }, []);

  const takeShot = () => {
    const angle = Math.random() * Math.PI * 2;
    const dx = Math.cos(angle) * 5;
    const dy = Math.sin(angle) * 5;
    velocityRef.current = { dx, dy };
    setShots((current) => current + 1);
    setMessage("Nice shot! Watch the ball bounce.");
  };

  return (
    <div className="space-y-6 w-full max-w-2xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">8 Ball Pool</h2>
        <p className="mt-2 text-slate-400">Shoot the cue ball around the table and enjoy the bounces.</p>
      </div>

      <div className="relative mx-auto h-56 w-[320px] overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 p-4 shadow-inner shadow-slate-950/40">
        <div className="absolute inset-4 rounded-[1.5rem] bg-green-700/95" />
        <div className="absolute inset-4 rounded-[1.5rem] border border-slate-800" />
        <div className="absolute left-4 top-4 h-12 w-24 rounded-full border border-slate-950 bg-slate-950/70" />
        <div className="absolute right-4 top-4 h-12 w-24 rounded-full border border-slate-950 bg-slate-950/70" />
        <div className="absolute left-4 bottom-4 h-12 w-24 rounded-full border border-slate-950 bg-slate-950/70" />
        <div className="absolute right-4 bottom-4 h-12 w-24 rounded-full border border-slate-950 bg-slate-950/70" />

        <div
          className="absolute h-8 w-8 rounded-full bg-white shadow-xl shadow-slate-900/40"
          style={{ left: ball.x, top: ball.y }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={takeShot}
          className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          Shoot
        </button>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          <p>Shots: {shots}</p>
          <p className="mt-2 text-slate-400">{message}</p>
        </div>
      </div>
    </div>
  );
}
