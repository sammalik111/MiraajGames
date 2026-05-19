"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";

const W = 360;
const H = 600;
const GRAVITY = 0.35;
const JUMP_V = -10;
const BOOST_V = -20;
const MOVE_SPEED = 4.5;
const PLAYER_W = 40;
const PLAYER_H = 40;
const PLATFORM_W = 64;
const PLATFORM_H = 12;
const BOOST_SIZE = 24;
const BOOST_SPAWN_CHANCE = 0.18; // per new platform row

type PlatformKind = "normal" | "death" | "moving";
interface Platform {
  x: number;
  y: number;
  kind: PlatformKind;
  vx?: number;
  minX?: number;
  maxX?: number;
}

// Boosts are NOT platforms — they're floating pickups that drift across
// the screen. Any contact applies BOOST_V and consumes the bubble.
interface Boost {
  x: number;
  y: number;
  vx: number;
}

function pickKind(altitude: number, forceLandable: boolean): PlatformKind {
  if (forceLandable) return "normal";
  const deathP = Math.min(0.22, altitude / 10000);
  const movingP = Math.min(0.32, altitude / 6000);
  const r = Math.random();
  if (r < deathP) return "death";
  if (r < deathP + movingP) return "moving";
  return "normal";
}

function makePlatform(y: number, altitude: number, forceLandable: boolean): Platform {
  const kind = pickKind(altitude, forceLandable);
  const x = Math.random() * (W - PLATFORM_W);
  const base: Platform = { x, y, kind };
  if (kind === "moving") {
    base.vx = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5);
    base.minX = Math.max(0, x - 60);
    base.maxX = Math.min(W - PLATFORM_W, x + 60);
  }
  return base;
}

function makeBoost(y: number): Boost {
  return {
    x: Math.random() * (W - BOOST_SIZE),
    y,
    vx: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5),
  };
}

export default function SkyJumpGame({ onGameEnd }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);

  const playerRef = useRef({ x: W / 2 - PLAYER_W / 2, y: H - 100, vx: 0, vy: 0 });
  const platformsRef = useRef<Platform[]>([]);
  const boostsRef = useRef<Boost[]>([]);
  const altitudeRef = useRef(0);
  const cameraYRef = useRef(0);
  const leftRef = useRef(false);
  const rightRef = useRef(false);
  const deadRef = useRef(false);
  const endedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Seed initial platforms — guaranteed reachable from the floor.
  const seed = useCallback(() => {
    const out: Platform[] = [];
    out.push({ x: W / 2 - PLATFORM_W / 2, y: H - 50, kind: "normal" });
    for (let i = 1; i < 12; i++) {
      out.push(makePlatform(H - 50 - i * 60, 0, false));
    }
    platformsRef.current = out;
  }, []);

  const reset = useCallback(() => {
    playerRef.current = { x: W / 2 - PLAYER_W / 2, y: H - 100, vx: 0, vy: 0 };
    altitudeRef.current = 0;
    cameraYRef.current = 0;
    deadRef.current = false;
    endedRef.current = false;
    boostsRef.current = [];
    setScore(0);
    setDead(false);
    seed();
  }, [seed]);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    // sky gradient that darkens with altitude
    const t = Math.min(1, altitudeRef.current / 8000);
    const top = `rgb(${Math.round(20 - 18 * t)},${Math.round(30 - 28 * t)},${Math.round(60 - 50 * t)})`;
    const bot = `rgb(${Math.round(60 - 50 * t)},${Math.round(100 - 80 * t)},${Math.round(200 - 180 * t)})`;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // platforms (world → screen via cameraY)
    for (const p of platformsRef.current) {
      const sy = p.y - cameraYRef.current;
      if (sy < -PLATFORM_H || sy > H) continue;
      const color = p.kind === "death" ? "#ff2a6d" : p.kind === "moving" ? "#00f0ff" : "#33ff77";
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x, sy, PLATFORM_W, PLATFORM_H);
      ctx.shadowBlur = 0;
    }

    // boosts — small floating bubbles drifting across the screen
    ctx.font = `${BOOST_SIZE}px serif`;
    ctx.textBaseline = "top";
    for (const b of boostsRef.current) {
      const sy = b.y - cameraYRef.current;
      if (sy < -BOOST_SIZE || sy > H) continue;
      ctx.fillText("🫧", b.x, sy);
    }

    // player (emoji)
    const ps = playerRef.current;
    const psy = ps.y - cameraYRef.current;
    ctx.font = `${PLAYER_W}px serif`;
    ctx.textBaseline = "top";
    ctx.fillText("🦘", ps.x, psy);
  }, []);

  const step = useCallback(() => {
    if (deadRef.current) return;
    const p = playerRef.current;

    // horizontal input
    p.vx = (leftRef.current ? -MOVE_SPEED : 0) + (rightRef.current ? MOVE_SPEED : 0);
    p.x += p.vx;
    // wrap horizontally
    if (p.x < -PLAYER_W) p.x = W;
    if (p.x > W) p.x = -PLAYER_W;

    // vertical physics
    p.vy += GRAVITY;
    const prevY = p.y;
    p.y += p.vy;

    // move moving platforms
    for (const pl of platformsRef.current) {
      if (pl.kind === "moving" && pl.vx !== undefined) {
        pl.x += pl.vx;
        if (pl.x <= (pl.minX ?? 0) || pl.x >= (pl.maxX ?? W - PLATFORM_W)) {
          pl.vx = -pl.vx;
          pl.x = Math.max(pl.minX ?? 0, Math.min(pl.maxX ?? W - PLATFORM_W, pl.x));
        }
      }
    }

    // drift boosts horizontally, wrap at screen edges
    for (const b of boostsRef.current) {
      b.x += b.vx;
      if (b.x < -BOOST_SIZE) b.x = W;
      else if (b.x > W) b.x = -BOOST_SIZE;
    }

    // boost pickup — any AABB overlap, regardless of vy. Consumed on use.
    boostsRef.current = boostsRef.current.filter((b) => {
      const overlap =
        p.x + PLAYER_W > b.x &&
        p.x < b.x + BOOST_SIZE &&
        p.y + PLAYER_H > b.y &&
        p.y < b.y + BOOST_SIZE;
      if (overlap) {
        p.vy = BOOST_V;
        return false;
      }
      return true;
    });

    // Platform landing — only on downward crossing of the top edge.
    if (p.vy > 0) {
      for (const pl of platformsRef.current) {
        const overlapX = p.x + PLAYER_W > pl.x && p.x < pl.x + PLATFORM_W;
        const crossed = prevY + PLAYER_H <= pl.y && p.y + PLAYER_H >= pl.y;
        if (overlapX && crossed) {
          if (pl.kind === "death") {
            deadRef.current = true;
            setDead(true);
            return;
          }
          p.y = pl.y - PLAYER_H;
          p.vy = JUMP_V;
          break;
        }
      }
    }

    // camera follows player up — never down
    const screenY = p.y - cameraYRef.current;
    if (screenY < H * 0.4) {
      const delta = H * 0.4 - screenY;
      cameraYRef.current -= delta;
      altitudeRef.current += delta;
    }

    // death: fell below visible window
    if (p.y - cameraYRef.current > H) {
      deadRef.current = true;
      setDead(true);
      return;
    }

    // Recycle platforms that scrolled below the viewport, generate new ones
    // above. Gap widens with altitude, capped at MAX_GAP (~ max reachable
    // jump height) so a single bounce always reaches the next platform.
    const visibleTop = cameraYRef.current - 100;
    const MAX_GAP = 100;
    const gap = Math.min(MAX_GAP, 55 + altitudeRef.current / 120);
    platformsRef.current = platformsRef.current.filter(
      (pl) => pl.y < cameraYRef.current + H + 50,
    );
    boostsRef.current = boostsRef.current.filter(
      (b) => b.y < cameraYRef.current + H + 50,
    );
    // Walk bottom-up: no two adjacent platforms may both be death. Each new
    // row has a chance to also drop a free-floating boost bubble nearby.
    while (platformsRef.current[platformsRef.current.length - 1]?.y > visibleTop - H) {
      const last = platformsRef.current[platformsRef.current.length - 1];
      const forceLandable = last?.kind === "death";
      const newY = last.y - gap;
      platformsRef.current.push(
        makePlatform(newY, altitudeRef.current, forceLandable),
      );
      if (Math.random() < BOOST_SPAWN_CHANCE) {
        boostsRef.current.push(makeBoost(newY - 25 - Math.random() * 20));
      }
    }

    setScore(Math.floor(altitudeRef.current));
    draw();
  }, [draw]);

  // game loop
  useEffect(() => {
    seed();
    draw();
    const loop = () => {
      step();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [seed, draw, step]);

  // input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") leftRef.current = true;
      else if (k === "arrowright" || k === "d") rightRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") leftRef.current = false;
      else if (k === "arrowright" || k === "d") rightRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    if (dead && !endedRef.current) {
      endedRef.current = true;
      onGameEnd(score, { altitude: Math.floor(altitudeRef.current) });
    }
  }, [dead, score, onGameEnd]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        Altitude <span className="text-[color:var(--neon-cyan)]">{score}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="border border-[color:var(--border-strong)]"
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        {dead ? "▸ wiped out" : "← → / A D · gold = boost · red = death · cyan = moving"}
      </p>
      {dead && (
        <button
          onClick={reset}
          className="hidden"
          aria-hidden
        >
          retry
        </button>
      )}
    </div>
  );
}
