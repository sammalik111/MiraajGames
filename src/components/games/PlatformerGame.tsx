"use client";

import React, { useEffect, useRef, useState } from "react";

const groundY = 146;
const stageWidth = 320;

export default function PlatformerGame() {
  const [position, setPosition] = useState({ x: 40, y: groundY });
  const velocity = useRef({ x: 0, y: 0 });
  const [status, setStatus] = useState("Use arrow keys to move, space to jump.");

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        velocity.current.x = -3;
        setStatus("Running left");
      }
      if (event.key === "ArrowRight") {
        velocity.current.x = 3;
        setStatus("Running right");
      }
      if (event.key === " " || event.key === "ArrowUp") {
        if (position.y >= groundY) {
          velocity.current.y = -12;
          setStatus("Jumping");
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        velocity.current.x = 0;
        setStatus("Idle");
      }
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [position.y]);

  useEffect(() => {
    const frame = window.setInterval(() => {
      setPosition((prev) => {
        const nextX = Math.min(Math.max(prev.x + velocity.current.x, 0), stageWidth - 36);
        const nextY = Math.min(prev.y + velocity.current.y, groundY);

        if (nextY < groundY) {
          velocity.current.y += 0.7;
        } else {
          velocity.current.y = 0;
        }

        return { x: nextX, y: nextY };
      });
    }, 16);

    return () => window.clearInterval(frame);
  }, []);

  return (
    <div className="space-y-6 w-full max-w-2xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Platformer Demo</h2>
        <p className="mt-2 text-slate-400">Move with left/right arrows and jump with spacebar or up arrow.</p>
      </div>

      <div className="relative h-64 overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 px-4 py-4 shadow-inner shadow-slate-950/40">
        <div className="absolute inset-x-0 top-0 h-3 bg-slate-800" />
        <div className="absolute left-6 top-20 h-3 w-20 rounded-full bg-slate-700" />
        <div className="absolute left-56 top-36 h-3 w-32 rounded-full bg-slate-700" />
        <div className="absolute left-10 top-80 h-3 w-24 rounded-full bg-slate-700" />
        <div className="absolute inset-x-0 bottom-0 h-8 bg-emerald-500/15" />
        <div
          className="absolute h-9 w-9 rounded-full bg-violet-400 shadow-xl shadow-violet-500/30"
          style={{ left: position.x, top: position.y }}
        />
        <div className="absolute bottom-0 left-3 h-10 w-20 rounded-2xl bg-slate-800" />
        <div className="absolute bottom-0 left-[136px] h-10 w-24 rounded-2xl bg-slate-800" />
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 text-slate-300">
        <span className="text-sm text-slate-400">Status:</span> {status}
      </div>
    </div>
  );
}
