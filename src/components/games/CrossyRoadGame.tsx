"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";

// Top-down hop game with a faux-isometric tilt rendered via shadows + trim.
// Levels scale: more lanes, faster traffic, sparser logs.

const COLS = 11;
const ROWS = 13;
const TILE = 40;
const W = COLS * TILE;
const H = ROWS * TILE;

type LaneType = "safe" | "road" | "river" | "rail";
type Lane = {
  type: LaneType;
  speed: number;
  obstacles: number[];
  spacing: number;
  width: number;
  decor: number[]; // x positions of trees/rocks for safe lanes
};

type Level = { num: number; lanes: Lane[] };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

// Deterministic-ish helpers — random looks fine because levels rebuild.
function buildLevel(num: number): Level {
  const baseSpeed = 1.4 + num * 0.35;
  const lanes: Lane[] = [];

  // Bottom safe row
  lanes.push(makeSafeLane(true));

  for (let r = 1; r < ROWS - 1; r++) {
    const block = Math.floor((r - 1) / 3);
    const within = (r - 1) % 3;
    let type: LaneType;
    if (within === 2) type = "safe";
    else type = block % 2 === 0 ? "road" : "river";

    if (type === "safe") {
      lanes.push(makeSafeLane(false));
      continue;
    }

    const dir = r % 2 === 0 ? 1 : -1;
    const speed = dir * (baseSpeed + Math.random() * 0.6);
    const spacing = type === "road"
      ? Math.max(3, 6 - num * 0.4 + Math.random() * 2)
      : Math.max(3.5, 5 - num * 0.2 + Math.random() * 1.5);
    const width = type === "road" ? 1 : 3 + Math.floor(Math.random() * 2);

    const obstacles: number[] = [];
    let x = Math.random() * spacing;
    while (x < COLS + width) {
      obstacles.push(x);
      x += spacing + width;
    }
    lanes.push({ type, speed, obstacles, spacing, width, decor: [] });
  }

  // Goal row
  lanes.push(makeSafeLane(false, true));
  return { num, lanes };
}

function makeSafeLane(isStart: boolean, isGoal = false): Lane {
  // Sparse decor on safe lanes — trees/rocks but never on the path the player takes.
  // We put decor at columns the player can simply hop around.
  const decor: number[] = [];
  if (!isStart && !isGoal) {
    const n = Math.floor(Math.random() * 3);
    const taken = new Set<number>();
    for (let i = 0; i < n; i++) {
      const c = Math.floor(Math.random() * COLS);
      if (!taken.has(c)) {
        decor.push(c);
        taken.add(c);
      }
    }
  }
  return { type: "safe", speed: 0, obstacles: [], spacing: 0, width: 0, decor };
}

const CAR_COLORS = ["#e64545", "#3aa1e6", "#f0a93a", "#9c5ed1", "#2bc78a", "#e84393"];

export default function CrossyRoadGame({ onGameEnd }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [levelNum, setLevelNum] = useState(1);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState<string | null>("Reach the top! Arrows / WASD to move");
  const [gameOver, setGameOver] = useState(false);
  // Refs mirror state for the rAF loop so it doesn't tear down each render
  // (which would reset `prev = performance.now()` and stutter every hop).
  const levelNumRef = useRef(1);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const messageRef = useRef<string | null>("Reach the top! Arrows / WASD to move");
  const gameOverRef = useRef(false);
  const endedRef = useRef(false);
  levelNumRef.current = levelNum;
  livesRef.current = lives;
  scoreRef.current = score;
  messageRef.current = message;
  gameOverRef.current = gameOver;

  const levelRef = useRef<Level>(buildLevel(1));
  const playerCol = useRef(Math.floor(COLS / 2));
  const playerRow = useRef(0);
  // Smooth visual position chasing logical position — gives that hop feel.
  const visualCol = useRef(Math.floor(COLS / 2));
  const visualRow = useRef(0);
  const hopAnim = useRef(0); // 0..1 lerp progress
  const facing = useRef<"up" | "down" | "left" | "right">("up");
  const ridingLog = useRef<{ lane: number; idx: number; offset: number } | null>(null);
  const particles = useRef<Particle[]>([]);
  const waterTime = useRef(0);
  const flashAlpha = useRef(0);
  const rafId = useRef<number | null>(null);

  const resetPlayer = useCallback(() => {
    playerCol.current = Math.floor(COLS / 2);
    playerRow.current = 0;
    visualCol.current = playerCol.current;
    visualRow.current = playerRow.current;
    ridingLog.current = null;
    facing.current = "up";
  }, []);

  const nextLevel = useCallback(() => {
    setScore((s) => s + 100);
    setLevelNum((n) => {
      const next = n + 1;
      levelRef.current = buildLevel(next);
      resetPlayer();
      setMessage(`Level ${next}!`);
      setTimeout(() => setMessage(null), 1200);
      return next;
    });
  }, [resetPlayer]);

  const die = useCallback(() => {
    flashAlpha.current = 0.7;
    // splatter particles
    const px = visualCol.current * TILE + TILE / 2;
    const py = H - (visualRow.current + 1) * TILE + TILE / 2;
    for (let i = 0; i < 12; i++) {
      particles.current.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.8) * 5,
        life: 40,
        color: "#ff5555",
      });
    }
    setLives((l) => {
      const left = l - 1;
      if (left <= 0) {
        setGameOver(true);
        gameOverRef.current = true;
        setMessage("Game Over");
        if (!endedRef.current) {
          endedRef.current = true;
          // Score = level reached (the player's progress number).
          onGameEnd(levelNumRef.current);
        }
      } else {
        setMessage(`Ouch! ${left} lives left`);
        setTimeout(() => setMessage(null), 900);
        resetPlayer();
      }
      return left;
    });
  }, [resetPlayer, onGameEnd]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;
      let dx = 0, dy = 0;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { dy = 1; facing.current = "up"; }
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { dy = -1; facing.current = "down"; }
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { dx = -1; facing.current = "left"; }
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { dx = 1; facing.current = "right"; }
      else return;
      e.preventDefault();

      const newCol = Math.max(0, Math.min(COLS - 1, playerCol.current + dx));
      const newRow = Math.max(0, Math.min(ROWS - 1, playerRow.current + dy));

      // Block decor on safe lanes
      const targetLane = levelRef.current.lanes[newRow];
      if (targetLane?.type === "safe" && targetLane.decor.includes(newCol)) {
        return;
      }

      if (newCol !== playerCol.current || newRow !== playerRow.current) {
        playerCol.current = newCol;
        playerRow.current = newRow;
        ridingLog.current = null;
        hopAnim.current = 0;
        if (dy > 0) setScore((s) => s + 10);
      }

      if (newRow === ROWS - 1) nextLevel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let prev = performance.now();

    const drawCar = (x: number, y: number, dir: number, color: string) => {
      // Body
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x + 3, y + TILE - 8, TILE - 6, 4); // shadow
      const grad = ctx.createLinearGradient(0, y, 0, y + TILE);
      grad.addColorStop(0, color);
      grad.addColorStop(1, shade(color, -30));
      ctx.fillStyle = grad;
      ctx.fillRect(x + 3, y + 6, TILE - 6, TILE - 14);
      // Roof
      ctx.fillStyle = shade(color, 20);
      ctx.fillRect(x + 7, y + 9, TILE - 14, 10);
      // Window
      ctx.fillStyle = "rgba(180,220,255,0.8)";
      if (dir > 0) ctx.fillRect(x + 8, y + 11, TILE - 22, 6);
      else ctx.fillRect(x + 14, y + 11, TILE - 22, 6);
      // Headlight
      ctx.fillStyle = "#fff5b4";
      if (dir > 0) ctx.fillRect(x + TILE - 7, y + TILE - 14, 3, 4);
      else ctx.fillRect(x + 4, y + TILE - 14, 3, 4);
      // Wheels
      ctx.fillStyle = "#111";
      ctx.fillRect(x + 5, y + TILE - 12, 6, 5);
      ctx.fillRect(x + TILE - 11, y + TILE - 12, 6, 5);
    };

    const drawLog = (x: number, y: number, widthTiles: number) => {
      const px = x;
      const w = widthTiles * TILE;
      // Shadow on water
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(px + 2, y + TILE - 6, w - 4, 4);
      // Body
      const grad = ctx.createLinearGradient(0, y + 4, 0, y + TILE - 4);
      grad.addColorStop(0, "#9a6230");
      grad.addColorStop(0.5, "#7a4a1f");
      grad.addColorStop(1, "#4e2e10");
      ctx.fillStyle = grad;
      ctx.fillRect(px, y + 4, w, TILE - 10);
      // End rings
      ctx.fillStyle = "#5a3414";
      ctx.fillRect(px, y + 4, 3, TILE - 10);
      ctx.fillRect(px + w - 3, y + 4, 3, TILE - 10);
      ctx.fillStyle = "#caa070";
      ctx.beginPath();
      ctx.ellipse(px + 1.5, y + 4 + (TILE - 10) / 2, 2, (TILE - 10) / 2 - 2, 0, 0, Math.PI * 2);
      ctx.ellipse(px + w - 1.5, y + 4 + (TILE - 10) / 2, 2, (TILE - 10) / 2 - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a3414";
      ctx.beginPath();
      ctx.arc(px + 1.5, y + 4 + (TILE - 10) / 2, 1, 0, Math.PI * 2);
      ctx.arc(px + w - 1.5, y + 4 + (TILE - 10) / 2, 1, 0, Math.PI * 2);
      ctx.fill();
      // Bark stripes
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      for (let k = 0; k < widthTiles; k++) {
        ctx.beginPath();
        ctx.moveTo(px + k * TILE, y + 8);
        ctx.lineTo(px + k * TILE, y + TILE - 8);
        ctx.stroke();
      }
    };

    const drawTree = (cx: number, cy: number) => {
      // trunk
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + TILE / 2 - 2, 12, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a3414";
      ctx.fillRect(cx - 4, cy + 6, 8, TILE / 2 - 6);
      // foliage (3 stacked circles for cute style)
      ctx.fillStyle = "#2e7d32";
      ctx.beginPath();
      ctx.arc(cx, cy + 6, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3da043";
      ctx.beginPath();
      ctx.arc(cx - 5, cy + 2, 9, 0, Math.PI * 2);
      ctx.arc(cx + 6, cy + 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(cx - 4, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawPlayer = (px: number, py: number, hopProg: number) => {
      const hopY = Math.sin(hopProg * Math.PI) * 8;
      const sx = px + TILE / 2;
      const sy = py + TILE / 2 - hopY;

      // Shadow (independent of hop height)
      ctx.fillStyle = `rgba(0,0,0,${0.35 - hopProg * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(sx, py + TILE - 6, 12 - hopProg * 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body (chick — yellow rounded square)
      const grad = ctx.createLinearGradient(sx, sy - 12, sx, sy + 12);
      grad.addColorStop(0, "#fff09a");
      grad.addColorStop(1, "#e0a000");
      ctx.fillStyle = grad;
      roundRect(ctx, sx - 12, sy - 12, 24, 24, 5);
      ctx.fill();
      // Belly
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      roundRect(ctx, sx - 8, sy, 16, 8, 4);
      ctx.fill();
      // Eyes (face the direction)
      const eyeOffsetX = facing.current === "left" ? -3 : facing.current === "right" ? 3 : 0;
      const eyeOffsetY = facing.current === "down" ? 2 : -2;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(sx - 4 + eyeOffsetX, sy - 4 + eyeOffsetY, 2.6, 0, Math.PI * 2);
      ctx.arc(sx + 4 + eyeOffsetX, sy - 4 + eyeOffsetY, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(sx - 4 + eyeOffsetX, sy - 4 + eyeOffsetY, 1.4, 0, Math.PI * 2);
      ctx.arc(sx + 4 + eyeOffsetX, sy - 4 + eyeOffsetY, 1.4, 0, Math.PI * 2);
      ctx.fill();
      // Beak
      ctx.fillStyle = "#ff8800";
      const bx = facing.current === "left" ? sx - 10 : facing.current === "right" ? sx + 10 : sx;
      const by = facing.current === "down" ? sy + 6 : sy + 2;
      ctx.beginPath();
      ctx.moveTo(bx - 3, by);
      ctx.lineTo(bx + 3, by);
      ctx.lineTo(bx, by + 4);
      ctx.closePath();
      ctx.fill();
    };

    const tick = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      waterTime.current += dt;

      const level = levelRef.current;

      // Advance obstacles
      for (const lane of level.lanes) {
        if (lane.type === "safe") continue;
        for (let i = 0; i < lane.obstacles.length; i++) {
          lane.obstacles[i] += lane.speed * dt;
        }
        if (lane.speed > 0) {
          for (let i = 0; i < lane.obstacles.length; i++) {
            if (lane.obstacles[i] > COLS + lane.width) {
              lane.obstacles[i] -= (lane.spacing + lane.width) * lane.obstacles.length;
            }
          }
        } else if (lane.speed < 0) {
          for (let i = 0; i < lane.obstacles.length; i++) {
            if (lane.obstacles[i] < -lane.width) {
              lane.obstacles[i] += (lane.spacing + lane.width) * lane.obstacles.length;
            }
          }
        }
      }

      // Player vs lane
      if (!gameOverRef.current) {
        const lane = level.lanes[playerRow.current];
        if (lane?.type === "river") {
          if (ridingLog.current && ridingLog.current.lane === playerRow.current) {
            const log = lane.obstacles[ridingLog.current.idx];
            playerCol.current = log + ridingLog.current.offset;
          } else {
            let found = false;
            for (let i = 0; i < lane.obstacles.length; i++) {
              const lx = lane.obstacles[i];
              if (playerCol.current + 0.5 >= lx && playerCol.current + 0.5 <= lx + lane.width) {
                ridingLog.current = { lane: playerRow.current, idx: i, offset: playerCol.current - lx };
                found = true;
                break;
              }
            }
            if (!found) die();
          }
          if (playerCol.current < -0.5 || playerCol.current > COLS - 0.5) die();
        } else if (lane?.type === "road") {
          ridingLog.current = null;
          for (const cx of lane.obstacles) {
            if (playerCol.current + 0.9 >= cx && playerCol.current + 0.1 <= cx + lane.width) {
              die();
              break;
            }
          }
        } else {
          ridingLog.current = null;
        }
      }

      // Smooth visual position
      hopAnim.current = Math.min(1, hopAnim.current + dt * 7);
      visualCol.current += (playerCol.current - visualCol.current) * Math.min(1, dt * 14);
      visualRow.current += (playerRow.current - visualRow.current) * Math.min(1, dt * 14);

      // --- Render ---
      // Backgrounds
      for (let r = 0; r < ROWS; r++) {
        const lane = level.lanes[r];
        const y = H - (r + 1) * TILE;
        if (lane.type === "safe") {
          if (r === 0) {
            // Start: deeper grass
            const g = ctx.createLinearGradient(0, y, 0, y + TILE);
            g.addColorStop(0, "#3a8a3a");
            g.addColorStop(1, "#2e7030");
            ctx.fillStyle = g;
          } else if (r === ROWS - 1) {
            // Goal: gold
            const g = ctx.createLinearGradient(0, y, 0, y + TILE);
            g.addColorStop(0, "#ffe266");
            g.addColorStop(1, "#e0a800");
            ctx.fillStyle = g;
          } else {
            const g = ctx.createLinearGradient(0, y, 0, y + TILE);
            g.addColorStop(0, "#5cba5c");
            g.addColorStop(1, "#469646");
            ctx.fillStyle = g;
          }
          ctx.fillRect(0, y, W, TILE);
          // Grass tufts
          if (r !== ROWS - 1) {
            ctx.fillStyle = "rgba(255,255,255,0.06)";
            for (let i = 0; i < COLS; i++) {
              ctx.fillRect(i * TILE + ((i * 17) % TILE), y + ((i * 13) % (TILE - 4)), 2, 2);
            }
          }
          // Goal stripes
          if (r === ROWS - 1) {
            ctx.fillStyle = "rgba(0,0,0,0.15)";
            for (let i = 0; i < COLS; i += 2) ctx.fillRect(i * TILE, y, TILE, 4);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 11px monospace";
            ctx.textAlign = "center";
            ctx.fillText("★ GOAL ★", W / 2, y + TILE - 6);
          }
          // Decor
          for (const cx of lane.decor) {
            drawTree(cx * TILE + TILE / 2, y);
          }
        } else if (lane.type === "road") {
          const g = ctx.createLinearGradient(0, y, 0, y + TILE);
          g.addColorStop(0, "#3a3a3a");
          g.addColorStop(1, "#222");
          ctx.fillStyle = g;
          ctx.fillRect(0, y, W, TILE);
          // Lane dashes
          ctx.fillStyle = "#ffd400";
          for (let i = 0; i < COLS; i++) {
            ctx.fillRect(i * TILE + TILE * 0.3, y + TILE / 2 - 1, TILE * 0.4, 2);
          }
          // Curb shadows
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(0, y, W, 2);
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(0, y + TILE - 2, W, 2);
        } else {
          // River
          const g = ctx.createLinearGradient(0, y, 0, y + TILE);
          g.addColorStop(0, "#1a5c9c");
          g.addColorStop(0.5, "#2a78c2");
          g.addColorStop(1, "#1f6aa6");
          ctx.fillStyle = g;
          ctx.fillRect(0, y, W, TILE);
          // Animated ripples
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          for (let i = 0; i < 6; i++) {
            const wx = ((i * 90 + waterTime.current * 30 * Math.sign(lane.speed || 1)) % (W + 60)) - 30;
            ctx.fillRect(wx, y + 8 + (i % 2) * 14, 18, 2);
          }
          // Top edge highlight
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.fillRect(0, y, W, 2);
        }
      }

      // Obstacles
      for (let r = 0; r < ROWS; r++) {
        const lane = level.lanes[r];
        if (lane.type === "safe") continue;
        const y = H - (r + 1) * TILE;
        for (let i = 0; i < lane.obstacles.length; i++) {
          const ox = lane.obstacles[i];
          const px = ox * TILE;
          if (lane.type === "road") {
            // Stable color per car index
            const color = CAR_COLORS[(i + r) % CAR_COLORS.length];
            drawCar(px, y, lane.speed > 0 ? 1 : -1, color);
          } else {
            drawLog(px, y, lane.width);
          }
        }
      }

      // Particles
      particles.current = particles.current.filter((p) => p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.life -= 1;
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      // Player
      const px = visualCol.current * TILE;
      const py = H - (visualRow.current + 1) * TILE;
      drawPlayer(px, py, hopAnim.current);

      // Death flash
      if (flashAlpha.current > 0) {
        ctx.fillStyle = `rgba(255,80,80,${flashAlpha.current})`;
        ctx.fillRect(0, 0, W, H);
        flashAlpha.current = Math.max(0, flashAlpha.current - 0.04);
      }

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, 28);
      ctx.fillStyle = "#5fb6ec";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`LV ${levelNumRef.current}`, 10, 19);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(`SCORE ${scoreRef.current}`, W / 2, 19);
      ctx.fillStyle = "#ff8aa0";
      ctx.textAlign = "right";
      ctx.fillText("♥".repeat(Math.max(0, livesRef.current)), W - 10, 19);

      const message = messageRef.current;
      if (message) {
        const tw = ctx.measureText(message).width;
        ctx.fillStyle = "rgba(0,0,0,0.78)";
        ctx.fillRect(W / 2 - tw / 2 - 16, H / 2 - 24, tw + 32, 48);
        ctx.strokeStyle = "#ffd400";
        ctx.lineWidth = 2;
        ctx.strokeRect(W / 2 - tw / 2 - 16, H / 2 - 24, tw + 32, 48);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText(message, W / 2, H / 2 + 6);
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
    // Loop sets up once per mount; reads game state via refs to avoid the
    // teardown stutter that resets `prev` and freezes obstacle motion.
  }, [die]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        <span>Level: <span className="text-[color:var(--neon-cyan)]">{levelNum}</span></span>
        <span>Score: <span className="text-[color:var(--neon-lime)]">{score}</span></span>
        <span>Lives: <span className="text-[color:var(--neon-magenta)]">{lives}</span></span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        tabIndex={0}
        className="border border-[color:var(--border-strong)] max-w-full h-auto outline-none rounded-sm shadow-[0_0_24px_rgba(0,0,0,0.4)]"
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] text-center max-w-md">
        Arrows/WASD to hop. Cross roads, ride logs, reach the top to advance.
      </p>
    </div>
  );
}

// Tiny utilities ----------------------------------------------------------

function shade(hex: string, amt: number): string {
  // Lighten/darken a #rrggbb hex by amt (-255..255).
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
