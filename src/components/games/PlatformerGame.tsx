"use client";

import React, { useEffect, useRef, useState } from "react";

const STAGE_WIDTH = 320;
const STAGE_HEIGHT = 256;
const PLAYER_SIZE = 28;
const GRAVITY = 0.6;
const JUMP_POWER = 11;
const MOVE_SPEED = 3;
const GROUND_Y = STAGE_HEIGHT - 24;

type Platform = { x: number; y: number; w: number; h: number };

const platforms: Platform[] = [
  { x: 0, y: STAGE_HEIGHT - 16, w: STAGE_WIDTH, h: 16 },
  { x: 40, y: 180, w: 80, h: 10 },
  { x: 180, y: 140, w: 90, h: 10 },
  { x: 60, y: 90, w: 70, h: 10 },
  { x: 220, y: 60, w: 80, h: 10 },
];

const GOAL = { x: 260, y: 60 - 24, size: 20 };

export default function PlatformerGame() {
  const posRef = useRef({ x: 40, y: GROUND_Y - PLAYER_SIZE });
  const velRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef({ left: false, right: false });
  const onGroundRef = useRef(true);
  const [, force] = useState(0);
  const [status, setStatus] = useState("Arrow keys move, space jumps. Reach the gold block!");
  const [won, setWon] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft") keysRef.current.left = true;
      if (e.key === "ArrowRight") keysRef.current.right = true;
      if ((e.key === " " || e.key === "ArrowUp") && onGroundRef.current) {
        velRef.current.y = -JUMP_POWER;
        onGroundRef.current = false;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keysRef.current.left = false;
      if (e.key === "ArrowRight") keysRef.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      if (won) { raf = requestAnimationFrame(step); return; }
      const pos = posRef.current;
      const vel = velRef.current;
      vel.x = (keysRef.current.right ? MOVE_SPEED : 0) - (keysRef.current.left ? MOVE_SPEED : 0);
      vel.y += GRAVITY;
      if (vel.y > 14) vel.y = 14;

      pos.x += vel.x;
      if (pos.x < 0) pos.x = 0;
      if (pos.x > STAGE_WIDTH - PLAYER_SIZE) pos.x = STAGE_WIDTH - PLAYER_SIZE;

      pos.y += vel.y;
      onGroundRef.current = false;

      for (const p of platforms) {
        const overlapX = pos.x + PLAYER_SIZE > p.x && pos.x < p.x + p.w;
        if (!overlapX) continue;
        const prevBottom = pos.y + PLAYER_SIZE - vel.y;
        if (vel.y >= 0 && prevBottom <= p.y && pos.y + PLAYER_SIZE >= p.y) {
          pos.y = p.y - PLAYER_SIZE;
          vel.y = 0;
          onGroundRef.current = true;
        }
      }

      const goalHit =
        pos.x + PLAYER_SIZE > GOAL.x &&
        pos.x < GOAL.x + GOAL.size &&
        pos.y + PLAYER_SIZE > GOAL.y &&
        pos.y < GOAL.y + GOAL.size;

      if (goalHit) {
        setWon(true);
        setStatus("You reached the goal! 🎉");
      } else {
        setStatus(vel.x === 0 && onGroundRef.current ? "Idle" : onGroundRef.current ? "Running" : "Airborne");
      }
      force((n) => (n + 1) % 1000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [won]);

  const reset = () => {
    posRef.current = { x: 40, y: GROUND_Y - PLAYER_SIZE };
    velRef.current = { x: 0, y: 0 };
    setWon(false);
  };

  return (
    <div className="space-y-6 w-full max-w-2xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Platformer</h2>
        <p className="mt-2 text-slate-400">Arrows to move, space/up to jump. Reach the gold block.</p>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-inner shadow-slate-950/40"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
        tabIndex={0}
      >
        {platforms.map((p, i) => (
          <div
            key={i}
            className="absolute rounded bg-slate-700"
            style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
          />
        ))}
        <div
          className="absolute rounded bg-yellow-400 shadow shadow-yellow-500/40"
          style={{ left: GOAL.x, top: GOAL.y, width: GOAL.size, height: GOAL.size }}
        />
        <div
          className="absolute rounded-lg bg-violet-400 shadow-xl shadow-violet-500/30"
          style={{ left: posRef.current.x, top: posRef.current.y, width: PLAYER_SIZE, height: PLAYER_SIZE }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          Status: {status}
        </div>
        <button
          onClick={reset}
          className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          Reset
        </button>
      </div>
    </div>
  );
}