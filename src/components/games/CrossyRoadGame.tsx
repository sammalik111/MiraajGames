"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Tile-based top-down hop game. Player advances upward to clear levels.
// Roads = cars (touch = die). Rivers = logs (must ride; water = die).
// Difficulty scales per level: more lanes, faster traffic, sparser logs.

const COLS = 11;
const ROWS = 13;
const TILE = 40;
const W = COLS * TILE;
const H = ROWS * TILE;

type LaneType = "safe" | "road" | "river";
type Lane = {
  type: LaneType;
  speed: number;       // tiles/sec, signed for direction
  obstacles: number[]; // x positions in tiles (float)
  spacing: number;     // gap in tiles between obstacles (logs/cars)
  width: number;       // length in tiles per obstacle
};

type Level = {
  num: number;
  lanes: Lane[];       // index 0 = bottom row (start side), last = goal side
};

function buildLevel(num: number): Level {
  // Difficulty scales: more hazards, faster, longer.
  const baseSpeed = 1.4 + num * 0.35;
  const lanes: Lane[] = [];

  // Bottom safe row (start)
  lanes.push({ type: "safe", speed: 0, obstacles: [], spacing: 0, width: 0 });

  for (let r = 1; r < ROWS - 1; r++) {
    // Pattern: alternate between road clusters and river clusters, with safe strips.
    const block = Math.floor((r - 1) / 3);
    const within = (r - 1) % 3;
    let type: LaneType;
    if (within === 2) type = "safe";
    else type = block % 2 === 0 ? "road" : "river";

    if (type === "safe") {
      lanes.push({ type, speed: 0, obstacles: [], spacing: 0, width: 0 });
      continue;
    }

    const dir = r % 2 === 0 ? 1 : -1;
    const speed = dir * (baseSpeed + Math.random() * 0.6);
    const spacing = type === "road"
      ? Math.max(3, 6 - num * 0.4 + Math.random() * 2)
      : Math.max(3.5, 5 - num * 0.2 + Math.random() * 1.5);
    const width = type === "road" ? 1 : 3 + Math.floor(Math.random() * 2);

    // Seed obstacles spread across width
    const obstacles: number[] = [];
    let x = Math.random() * spacing;
    while (x < COLS + width) {
      obstacles.push(x);
      x += spacing + width;
    }
    lanes.push({ type, speed, obstacles, spacing, width });
  }

  // Top goal row
  lanes.push({ type: "safe", speed: 0, obstacles: [], spacing: 0, width: 0 });
  return { num, lanes };
}

export default function CrossyRoadGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [levelNum, setLevelNum] = useState(1);
  const [lives, setLives] = useState(3);
  const [message, setMessage] = useState<string | null>("Reach the top! Arrows / WASD to move");
  const [gameOver, setGameOver] = useState(false);

  const levelRef = useRef<Level>(buildLevel(1));
  // Player position in tile units; y is row index (0 = bottom).
  const playerCol = useRef(Math.floor(COLS / 2));
  const playerRow = useRef(0);
  // For river riding: track which log we're attached to so we drift with it.
  const ridingLog = useRef<{ lane: number; idx: number; offset: number } | null>(null);
  const rafId = useRef<number | null>(null);

  const resetPlayer = useCallback(() => {
    playerCol.current = Math.floor(COLS / 2);
    playerRow.current = 0;
    ridingLog.current = null;
  }, []);

  const nextLevel = useCallback(() => {
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
    setLives((l) => {
      const left = l - 1;
      if (left <= 0) {
        setGameOver(true);
        setMessage("Game Over — press R to restart");
      } else {
        setMessage(`Ouch! ${left} lives left`);
        setTimeout(() => setMessage(null), 900);
        resetPlayer();
      }
      return left;
    });
  }, [resetPlayer]);

  const restart = useCallback(() => {
    setLevelNum(1);
    setLives(3);
    setGameOver(false);
    levelRef.current = buildLevel(1);
    resetPlayer();
    setMessage("Reach the top! Arrows / WASD to move");
  }, [resetPlayer]);

  // Movement is grid-snapped — one keypress = one hop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver && (e.key === "r" || e.key === "R")) {
        restart();
        return;
      }
      if (gameOver) return;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dy = 1;
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dy = -1;
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dx = -1;
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dx = 1;
      else return;
      e.preventDefault();

      const newCol = Math.max(0, Math.min(COLS - 1, playerCol.current + dx));
      const newRow = Math.max(0, Math.min(ROWS - 1, playerRow.current + dy));
      // If we're moving off a log, snap our absolute column first then clamp.
      playerCol.current = newCol;
      playerRow.current = newRow;
      ridingLog.current = null; // re-evaluate next tick

      if (newRow === ROWS - 1) {
        nextLevel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameOver, nextLevel, restart]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let prev = performance.now();

    const tick = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;

      const level = levelRef.current;

      // Advance obstacles
      for (const lane of level.lanes) {
        if (lane.type === "safe") continue;
        for (let i = 0; i < lane.obstacles.length; i++) {
          lane.obstacles[i] += lane.speed * dt;
        }
        // Wrap obstacles around so traffic is continuous.
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

      // Resolve player vs current lane
      if (!gameOver) {
        const lane = level.lanes[playerRow.current];
        if (lane?.type === "river") {
          // If riding a log, drift with it. Otherwise, find one we're standing on.
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
            if (!found) {
              die();
            }
          }
          // Drown if pushed off-screen by the log.
          if (playerCol.current < -0.5 || playerCol.current > COLS - 0.5) {
            die();
          }
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

      // --- Render ---
      // Background
      for (let r = 0; r < ROWS; r++) {
        const lane = level.lanes[r];
        const y = H - (r + 1) * TILE;
        if (lane.type === "safe") {
          ctx.fillStyle = r === 0 ? "#3a7d3a" : r === ROWS - 1 ? "#f5d142" : "#4ea84e";
        } else if (lane.type === "road") {
          ctx.fillStyle = "#333";
        } else {
          ctx.fillStyle = "#2a78c2";
        }
        ctx.fillRect(0, y, W, TILE);

        // Road dashes
        if (lane.type === "road") {
          ctx.fillStyle = "#ffd400";
          for (let i = 0; i < COLS; i++) {
            ctx.fillRect(i * TILE + TILE * 0.3, y + TILE / 2 - 1, TILE * 0.4, 2);
          }
        }
      }

      // Obstacles
      for (let r = 0; r < ROWS; r++) {
        const lane = level.lanes[r];
        if (lane.type === "safe") continue;
        const y = H - (r + 1) * TILE;
        for (const ox of lane.obstacles) {
          const px = ox * TILE;
          if (lane.type === "road") {
            ctx.fillStyle = lane.speed > 0 ? "#e64545" : "#3aa1e6";
            ctx.fillRect(px + 4, y + 6, lane.width * TILE - 8, TILE - 12);
            ctx.fillStyle = "#fff";
            ctx.fillRect(px + 8, y + 10, 6, 6);
            ctx.fillRect(px + lane.width * TILE - 14, y + 10, 6, 6);
          } else {
            ctx.fillStyle = "#7a4a1f";
            ctx.fillRect(px, y + 6, lane.width * TILE, TILE - 12);
            ctx.fillStyle = "#5a3414";
            for (let k = 0; k < lane.width; k++) {
              ctx.fillRect(px + k * TILE + TILE - 2, y + 6, 2, TILE - 12);
            }
          }
        }
      }

      // Player
      const px = playerCol.current * TILE;
      const py = H - (playerRow.current + 1) * TILE;
      ctx.fillStyle = "#fff";
      ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
      ctx.fillStyle = "#000";
      ctx.fillRect(px + 12, py + 14, 4, 4);
      ctx.fillRect(px + TILE - 16, py + 14, 4, 4);
      ctx.fillStyle = "#ff7a00";
      ctx.fillRect(px + 14, py + TILE - 16, TILE - 28, 4);

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, 26);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`LV ${levelNum}`, 8, 18);
      ctx.textAlign = "right";
      ctx.fillText(`♥ ${lives}`, W - 8, 18);

      if (message) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, H / 2 - 22, W, 44);
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
  }, [levelNum, lives, message, gameOver, die]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        <span>Level: <span className="text-[color:var(--neon-cyan)]">{levelNum}</span></span>
        <span>Lives: <span className="text-[color:var(--neon-magenta)]">{lives}</span></span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        tabIndex={0}
        className="border border-[color:var(--border-strong)] max-w-full h-auto outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={restart}
          className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-2 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:ring-cyan transition"
        >
          Restart
        </button>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] text-center max-w-md">
        Arrows/WASD to hop. Cross roads, ride logs, reach the top to advance.
      </p>
    </div>
  );
}
