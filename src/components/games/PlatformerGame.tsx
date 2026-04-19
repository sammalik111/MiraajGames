"use client";

import React, { useEffect, useRef, useState } from "react";

const WORLD_WIDTH = 2000;
const STAGE_WIDTH = 400;
const STAGE_HEIGHT = 280;
const PLAYER_W = 20;
const PLAYER_H = 26;
const GRAVITY = 0.55;
const JUMP_POWER = 11;
const MAX_FALL = 14;

type Platform = { x: number; y: number; w: number; h: number; type?: "grass" | "brick" | "stone" };
type Enemy = { id: number; x: number; y: number; vx: number; alive: boolean };
type Coin = { x: number; y: number; collected: boolean };

const GROUND_Y = STAGE_HEIGHT - 20;

const platforms: Platform[] = [
  // --- Ground sections (gaps between them are pits) ---
  { x: 0,    y: GROUND_Y, w: 340,  h: 20, type: "grass" },
  { x: 380,  y: GROUND_Y, w: 200,  h: 20, type: "grass" },   // gap: 340-380
  { x: 630,  y: GROUND_Y, w: 120,  h: 20, type: "grass" },   // gap: 580-630
  { x: 800,  y: GROUND_Y, w: 280,  h: 20, type: "grass" },   // gap: 750-800
  { x: 1140, y: GROUND_Y, w: 160,  h: 20, type: "grass" },   // gap: 1080-1140
  { x: 1380, y: GROUND_Y, w: 240,  h: 20, type: "grass" },   // gap: 1300-1380
  { x: 1700, y: GROUND_Y, w: 300,  h: 20, type: "grass" },   // gap: 1620-1700

  // --- Floating platforms ---
  { x: 120,  y: GROUND_Y - 70,  w: 80,  h: 12, type: "brick" },
  { x: 250,  y: GROUND_Y - 120, w: 70,  h: 12, type: "brick" },
  { x: 420,  y: GROUND_Y - 80,  w: 100, h: 12, type: "brick" },
  { x: 560,  y: GROUND_Y - 130, w: 80,  h: 12, type: "brick" },
  { x: 660,  y: GROUND_Y - 70,  w: 70,  h: 12, type: "brick" },
  { x: 840,  y: GROUND_Y - 90,  w: 90,  h: 12, type: "brick" },
  { x: 980,  y: GROUND_Y - 60,  w: 80,  h: 12, type: "brick" },
  { x: 1060, y: GROUND_Y - 130, w: 90,  h: 12, type: "brick" },
  { x: 1200, y: GROUND_Y - 80,  w: 100, h: 12, type: "brick" },
  { x: 1340, y: GROUND_Y - 130, w: 80,  h: 12, type: "brick" },
  { x: 1460, y: GROUND_Y - 70,  w: 100, h: 12, type: "brick" },
  { x: 1580, y: GROUND_Y - 120, w: 80,  h: 12, type: "brick" },
  { x: 1650, y: GROUND_Y - 60,  w: 70,  h: 12, type: "brick" },
  { x: 1760, y: GROUND_Y - 90,  w: 90,  h: 12, type: "brick" },
  { x: 1880, y: GROUND_Y - 60,  w: 100, h: 12, type: "stone" },
];

const initialEnemies: Enemy[] = [
  { id: 0, x: 160,  y: GROUND_Y - 22, vx: 1,  alive: true },
  { id: 1, x: 440,  y: GROUND_Y - 22, vx: -1, alive: true },
  { id: 2, x: 660,  y: GROUND_Y - 22, vx: 1,  alive: true },
  { id: 3, x: 860,  y: GROUND_Y - 22, vx: -1, alive: true },
  { id: 4, x: 1000, y: GROUND_Y - 22, vx: 1,  alive: true },
  { id: 5, x: 1200, y: GROUND_Y - 22, vx: -1, alive: true },
  { id: 6, x: 1420, y: GROUND_Y - 22, vx: 1,  alive: true },
  { id: 7, x: 1760, y: GROUND_Y - 22, vx: -1, alive: true },
];

const coinDefs: Coin[] = [
  120, 180, 260, 420, 470, 570, 660, 850, 900, 1000,
  1060, 1200, 1260, 1350, 1460, 1580, 1760, 1840,
].map((x, i) => ({ x, y: GROUND_Y - 50, collected: false }));

const GOAL = { x: 1900, y: GROUND_Y - 56, w: 24, h: 56 };

// Enemy size
const E_W = 20, E_H = 18;

function hasPlatformUnder(x: number, footY: number, w: number): boolean {
  return platforms.some(
    (p) => x + w > p.x && x < p.x + p.w && footY >= p.y - 2 && footY <= p.y + 6
  );
}

export default function PlatformerGame() {
  const posRef  = useRef({ x: 40, y: GROUND_Y - PLAYER_H });
  const velRef  = useRef({ x: 0, y: 0 });
  const keysRef = useRef({ left: false, right: false, jumpHeld: false, jumpQueued: false });
  const onGroundRef   = useRef(true);
  const jumpUsedRef   = useRef(false);
  const [, force]     = useState(0);
  const [status, setStatus]   = useState("Arrow keys / WASD move, space or ↑ jumps.");
  const [won, setWon]         = useState(false);
  const [dead, setDead]       = useState(false);
  const [score, setScore]     = useState(0);
  const [cameraX, setCameraX] = useState(0);
  const enemiesRef = useRef<Enemy[]>(initialEnemies.map(e => ({ ...e })));
  const coinsRef   = useRef<Coin[]>(coinDefs.map(c => ({ ...c })));

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," ","w","a","d"].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft"  || e.key === "a") keysRef.current.left = true;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = true;
      if ((e.key === " " || e.key === "ArrowUp" || e.key === "w") && !keysRef.current.jumpHeld) {
        keysRef.current.jumpQueued = true;
        keysRef.current.jumpHeld  = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft"  || e.key === "a") keysRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = false;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") keysRef.current.jumpHeld = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const doReset = () => {
    posRef.current  = { x: 40, y: GROUND_Y - PLAYER_H };
    velRef.current  = { x: 0, y: 0 };
    onGroundRef.current  = true;
    jumpUsedRef.current  = false;
    enemiesRef.current   = initialEnemies.map(e => ({ ...e }));
    coinsRef.current     = coinDefs.map(c => ({ ...c }));
    setCameraX(0);
    setScore(0);
    setWon(false);
    setDead(false);
    setStatus("Arrow keys / WASD move, space or ↑ jumps.");
  };

  useEffect(() => {
    let raf = 0;
    const step = () => {
      if (won || dead) { raf = requestAnimationFrame(step); return; }

      const pos = posRef.current;
      const vel = velRef.current;

      // Horizontal movement with acceleration
      const accel = 0.6, maxSpeed = 5, friction = 0.78;
      if (keysRef.current.right) vel.x = Math.min(vel.x + accel, maxSpeed);
      if (keysRef.current.left)  vel.x = Math.max(vel.x - accel, -maxSpeed);
      if (!keysRef.current.left && !keysRef.current.right) vel.x *= friction;
      if (Math.abs(vel.x) < 0.15) vel.x = 0;

      vel.y = Math.min(vel.y + GRAVITY, MAX_FALL);

      // Jump: only when on ground, consume the queued press
      if (keysRef.current.jumpQueued && onGroundRef.current && !jumpUsedRef.current) {
        vel.y = -JUMP_POWER;
        onGroundRef.current  = false;
        jumpUsedRef.current  = true;
      }
      keysRef.current.jumpQueued = false;

      // Move X
      pos.x += vel.x;
      pos.x = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_W, pos.x));

      // Move Y + platform collision
      pos.y += vel.y;
      onGroundRef.current = false;
      for (const p of platforms) {
        const overlapX = pos.x + PLAYER_W > p.x && pos.x < p.x + p.w;
        if (!overlapX) continue;
        const prevBottom = pos.y + PLAYER_H - vel.y;
        if (vel.y >= 0 && prevBottom <= p.y + 2 && pos.y + PLAYER_H >= p.y) {
          pos.y = p.y - PLAYER_H;
          vel.y = 0;
          onGroundRef.current = true;
          jumpUsedRef.current = false;
        }
      }

      // Coin collection
      coinsRef.current.forEach((c) => {
        if (c.collected) return;
        if (pos.x + PLAYER_W > c.x && pos.x < c.x + 12 && pos.y + PLAYER_H > c.y && pos.y < c.y + 12) {
          c.collected = true;
          setScore((s) => s + 10);
        }
      });

      // Enemies: move & check edge
      enemiesRef.current.forEach((e) => {
        if (!e.alive) return;
        const nx = e.x + e.vx;
        const nextFootY = e.y + E_H;
        const frontEdge = e.vx > 0 ? nx + E_W : nx;
        if (!hasPlatformUnder(frontEdge - 1, nextFootY, 2) || nx < 20 || nx > WORLD_WIDTH - E_W - 20) {
          e.vx *= -1;
        } else {
          e.x = nx;
        }
      });

      // Enemy collision: land on top to stomp, touch side to die
      const aliveEnemies = enemiesRef.current.filter(e => e.alive);
      for (const e of aliveEnemies) {
        const overlapX = pos.x + PLAYER_W > e.x + 2 && pos.x < e.x + E_W - 2;
        const overlapY = pos.y + PLAYER_H > e.y && pos.y < e.y + E_H;
        if (!overlapX || !overlapY) continue;
        const prevBottom = pos.y + PLAYER_H - vel.y;
        if (vel.y > 0 && prevBottom <= e.y + 4) {
          // Stomp
          e.alive = false;
          vel.y = -7;
          setScore((s) => s + 100);
          setStatus("Stomped! +100");
        } else {
          // Side hit → die
          setDead(true);
          setStatus("Hit by an enemy — try again.");
          raf = requestAnimationFrame(step);
          return;
        }
      }

      // Fall death — only after player is well below the stage
      if (pos.y > STAGE_HEIGHT + 250) {
        setDead(true);
        setStatus("Fell into a pit — try again.");
        raf = requestAnimationFrame(step);
        return;
      }

      // Camera
      const cam = Math.max(0, Math.min(pos.x + PLAYER_W / 2 - STAGE_WIDTH / 2, WORLD_WIDTH - STAGE_WIDTH));
      setCameraX(cam);

      // Goal (flag)
      if (pos.x + PLAYER_W > GOAL.x && pos.x < GOAL.x + GOAL.w && pos.y + PLAYER_H > GOAL.y) {
        setWon(true);
        setStatus(`You reached the goal! 🎉 Score: ${score}`);
      }

      force((n) => (n + 1) % 100000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [won, dead]);

  const pos = posRef.current;
  const cam = cameraX;

  return (
    <div className="space-y-4 w-full max-w-2xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Mario-Style Platformer</h2>
        <p className="mt-1 text-slate-400 text-sm">Arrows / WASD + Space. Stomp enemies. Reach the flag.</p>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-[2rem] border-2 border-slate-700 shadow-2xl"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      >
        {/* Sky */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, #87ceeb 0%, #b0e0f8 70%, #c8edd8 100%)" }} />
        {/* Clouds (fixed in screen space) */}
        {[40, 160, 290, 350].map((cx, i) => (
          <div key={i} className="absolute rounded-full bg-white/80" style={{ left: cx, top: 20 + (i % 2) * 16, width: 48 + (i % 3) * 16, height: 18 }} />
        ))}
        {/* Pit darkness at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-5 bg-slate-950" />

        {/* World */}
        <div className="absolute top-0 left-0" style={{ width: WORLD_WIDTH, height: STAGE_HEIGHT, transform: `translateX(${-cam}px)` }}>

          {/* Platforms */}
          {platforms.map((p, i) => (
            <React.Fragment key={i}>
              {/* Grass or brick top */}
              <div className="absolute" style={{
                left: p.x, top: p.y, width: p.w, height: p.h,
                background:
                  p.type === "grass"  ? "#5a3e1b" :
                  p.type === "brick"  ? "#c0673a" :
                  "#8a7a6a",
              }} />
              {/* Green cap on grass platforms */}
              {p.type === "grass" && (
                <div className="absolute" style={{ left: p.x, top: p.y - 4, width: p.w, height: 6, background: "#3a9c35", borderRadius: "3px 3px 0 0" }} />
              )}
            </React.Fragment>
          ))}

          {/* Coins */}
          {coinsRef.current.filter(c => !c.collected).map((c, i) => (
            <div key={i} className="absolute rounded-full border-2 border-yellow-500" style={{
              left: c.x, top: c.y, width: 12, height: 12,
              background: "#fbbf24",
              boxShadow: "0 0 4px #fbbf2480",
            }} />
          ))}

          {/* Enemies — goomba style */}
          {enemiesRef.current.filter(e => e.alive).map((e) => (
            <div key={e.id} className="absolute" style={{ left: e.x, top: e.y, width: E_W, height: E_H }}>
              {/* Body */}
              <div className="absolute inset-0 rounded-t-full" style={{ background: "#8b4513", borderRadius: "50% 50% 40% 40% / 60% 60% 40% 40%" }} />
              {/* Eyes */}
              <div className="absolute" style={{ left: 3, top: 5, width: 5, height: 5, background: "white", borderRadius: "50%" }}>
                <div className="absolute" style={{ left: 1, top: 1, width: 3, height: 3, background: "#111", borderRadius: "50%" }} />
              </div>
              <div className="absolute" style={{ left: 12, top: 5, width: 5, height: 5, background: "white", borderRadius: "50%" }}>
                <div className="absolute" style={{ left: 1, top: 1, width: 3, height: 3, background: "#111", borderRadius: "50%" }} />
              </div>
              {/* Feet */}
              <div className="absolute bottom-0 left-0 rounded-full" style={{ width: 9, height: 5, background: "#5a2d0c" }} />
              <div className="absolute bottom-0 right-0 rounded-full" style={{ width: 9, height: 5, background: "#5a2d0c" }} />
            </div>
          ))}

          {/* Goal flag */}
          <div className="absolute" style={{ left: GOAL.x, top: GOAL.y, width: GOAL.w, height: GOAL.h }}>
            <div className="absolute" style={{ left: 10, top: 0, width: 3, height: GOAL.h, background: "#555" }} />
            <div className="absolute" style={{ left: 13, top: 0, width: 16, height: 12, background: "#22c55e" }} />
          </div>

          {/* Player */}
          <div className="absolute" style={{ left: pos.x, top: pos.y, width: PLAYER_W, height: PLAYER_H, opacity: dead ? 0.4 : 1 }}>
            {/* Hat */}
            <div className="absolute" style={{ left: 2, top: 0, width: 16, height: 6, background: "#dc2626", borderRadius: "3px 3px 0 0" }} />
            <div className="absolute" style={{ left: 0, top: 5, width: PLAYER_W, height: 3, background: "#dc2626" }} />
            {/* Head */}
            <div className="absolute" style={{ left: 2, top: 7, width: 16, height: 10, background: "#fde68a", borderRadius: "40% 40% 30% 30%" }} />
            {/* Eye */}
            <div className="absolute" style={{ left: 13, top: 9, width: 4, height: 4, background: "white", borderRadius: "50%" }}>
              <div className="absolute" style={{ left: 1, top: 1, width: 2, height: 2, background: "#111", borderRadius: "50%" }} />
            </div>
            {/* Body */}
            <div className="absolute" style={{ left: 1, top: 16, width: PLAYER_W - 2, height: 10, background: "#2563eb", borderRadius: "2px" }} />
          </div>
        </div>

        {/* HUD overlay */}
        <div className="pointer-events-none absolute top-2 left-3 flex gap-3 text-xs font-bold" style={{ textShadow: "1px 1px 2px #000" }}>
          <span className="text-yellow-300">⭐ {score}</span>
          {won  && <span className="text-green-300">WIN!</span>}
          {dead && <span className="text-red-400">DEAD</span>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300 truncate">
          {status}
        </div>
        <button
          onClick={doReset}
          className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          Restart Level
        </button>
      </div>
    </div>
  );
}