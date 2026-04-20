"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ── Maze ───────────────────────────────────────────────────────────────────
// '#' = wall, '.' = dot, 'o' = power pellet, ' ' = empty, 'P' = pacman start, 'G' = ghost pen

const MAZE_ROWS = [
  "###################",
  "#........#........#",
  "#o##.###.#.###.##o#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.###.#.###.####",
  "   #.#   G   #.#   ",
  "####.# ##=## #.####",
  "     .  GGG  .     ",
  "####.# ##### #.####",
  "   #.#       #.#   ",
  "####.# ##### #.####",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#o.#.....P.....#.o#",
  "##.#.#.#####.#.#.##",
  "#....#...#...#....#",
  "#.######.#.######.#",
  "#.................#",
  "###################",
];

const CELL = 20;
const COLS = MAZE_ROWS[0].length;
const ROWS = MAZE_ROWS.length;

// ── Level Config ───────────────────────────────────────────────────────────

interface LevelConfig {
  numGhosts: number;
  tickMs: number;
  scaredDuration: number;
}

const LEVELS: LevelConfig[] = [
  { numGhosts: 2, tickMs: 145, scaredDuration: 25 },
  { numGhosts: 3, tickMs: 120, scaredDuration: 18 },
  { numGhosts: 4, tickMs: 100, scaredDuration: 12 },
];

const GHOST_COLORS = ["#ef4444", "#ec4899", "#22d3ee", "#f97316"];
const GHOST_SCARED = "#60a5fa";

// ── Types ──────────────────────────────────────────────────────────────────

type Dir = "up" | "down" | "left" | "right" | "none";

interface Ghost {
  x: number;
  y: number;
  dir: Dir;
  scared: number; // countdown ticks
  color: string;
}

interface GameState {
  pacX: number;
  pacY: number;
  pacDir: Dir;
  nextDir: Dir;
  dots: boolean[][]; // true = dot/pellet present
  pellets: boolean[][];
  ghosts: Ghost[];
  score: number;
  lives: number;
  level: number;
  tickCount: number;
  invincTicks: number; // frames of invincibility after being hit
  phase: "playing" | "levelComplete" | "gameOver" | "win";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isWall(row: number, col: number): boolean {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  const ch = MAZE_ROWS[row][col];
  return ch === "#" || ch === "=" || ch === " ";
}

function parseMaze() {
  const dots: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const pellets: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  let pacX = 9; let pacY = 15;
  const ghostPositions: Array<[number, number]> = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = MAZE_ROWS[r][c];
      if (ch === ".") dots[r][c] = true;
      else if (ch === "o") pellets[r][c] = true;
      else if (ch === "P") { pacX = c; pacY = r; }
      else if (ch === "G") ghostPositions.push([r, c]);
    }
  }
  return { dots, pellets, pacX, pacY, ghostPositions };
}

const { ghostPositions: GHOST_STARTS } = parseMaze();

function buildInitialState(levelIdx: number): GameState {
  const { dots, pellets, pacX, pacY } = parseMaze();
  const cfg = LEVELS[levelIdx];
  const ghosts: Ghost[] = [];
  const positions = GHOST_STARTS.length > 0 ? GHOST_STARTS : [[9, 9], [9, 10], [10, 9], [10, 10]];
  for (let i = 0; i < cfg.numGhosts; i++) {
    const pos = positions[i % positions.length];
    ghosts.push({
      x: pos[1],
      y: pos[0],
      dir: (["left", "right", "up", "down"] as Dir[])[i % 4],
      scared: 0,
      color: GHOST_COLORS[i],
    });
  }
  return {
    pacX, pacY, pacDir: "none", nextDir: "none",
    dots, pellets, ghosts,
    score: 0, lives: 3, level: levelIdx + 1,
    tickCount: 0, invincTicks: 0, phase: "playing",
  };
}

function tryMove(x: number, y: number, dir: Dir): { x: number; y: number } | null {
  let nx = x; let ny = y;
  if (dir === "left") nx--;
  else if (dir === "right") nx++;
  else if (dir === "up") ny--;
  else if (dir === "down") ny++;
  else return { x, y };
  // Wrap tunnels
  nx = (nx + COLS) % COLS;
  ny = (ny + ROWS) % ROWS;
  if (isWall(ny, nx)) return null;
  return { x: nx, y: ny };
}

const DIRS: Dir[] = ["up", "down", "left", "right"];
function randomDir(ghost: Ghost): Dir {
  const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
  for (const d of shuffled) {
    if (d === oppositeDir(ghost.dir)) continue;
    const res = tryMove(ghost.x, ghost.y, d);
    if (res) return d;
  }
  return ghost.dir;
}
function oppositeDir(d: Dir): Dir {
  if (d === "up") return "down";
  if (d === "down") return "up";
  if (d === "left") return "right";
  if (d === "right") return "left";
  return "none";
}

// ── Ad Placeholder ─────────────────────────────────────────────────────────

function AdPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-slate-500 font-semibold tracking-widest uppercase">
        Advertisement
      </span>
      <div
        className="rounded border border-slate-600 bg-slate-800 flex items-center justify-center text-slate-500 text-sm font-medium"
        style={{ width: 300, height: 250 }}
      >
        300 × 250 Ad
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PacmanGame() {
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(3);
  const [uiLevel, setUiLevel] = useState(1);
  const [phase, setPhase] = useState<"playing" | "levelComplete" | "gameOver" | "win">("playing");
  const [levelMsg, setLevelMsg] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GameState>(buildInitialState(0));
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const phaseRef = useRef<"playing" | "levelComplete" | "gameOver" | "win">("playing");

  phaseRef.current = phase;

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gs = gsRef.current;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    // Draw maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = MAZE_ROWS[r][c];
        if (ch === "#") {
          ctx.fillStyle = "#1e40af";
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          // Wall highlight
          ctx.fillStyle = "#3b82f6";
          ctx.fillRect(c * CELL, r * CELL, CELL, 2);
          ctx.fillRect(c * CELL, r * CELL, 2, CELL);
        } else if (ch === "=") {
          ctx.fillStyle = "#ec4899";
          ctx.fillRect(c * CELL, r * CELL + CELL / 2 - 2, CELL, 4);
        }
        // Dots
        if (gs.dots[r][c]) {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        // Power pellets
        if (gs.pellets[r][c]) {
          ctx.fillStyle = "#fde047";
          ctx.beginPath();
          ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw ghosts
    gs.ghosts.forEach((ghost) => {
      const gx = ghost.x * CELL + CELL / 2;
      const gy = ghost.y * CELL + CELL / 2;
      ctx.fillStyle = ghost.scared > 0 ? GHOST_SCARED : ghost.color;
      ctx.beginPath();
      ctx.arc(gx, gy - 1, CELL / 2 - 2, Math.PI, 0);
      ctx.lineTo(gx + CELL / 2 - 2, gy + CELL / 2 - 2);
      // Wavy bottom
      const hw = CELL / 2 - 2;
      for (let i = 0; i < 3; i++) {
        const wx = gx + hw - (i * 2 * hw) / 3;
        ctx.quadraticCurveTo(wx - hw / 3, gy + CELL / 2 + 3, wx - (2 * hw) / 3, gy + CELL / 2 - 2);
      }
      ctx.lineTo(gx - hw, gy + CELL / 2 - 2);
      ctx.closePath();
      ctx.fill();
      // Eyes
      if (ghost.scared === 0) {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(gx - 4, gy - 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(gx + 4, gy - 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1d4ed8";
        ctx.beginPath(); ctx.arc(gx - 3, gy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(gx + 5, gy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    });

    // Draw Pac-Man (flash during invincibility)
    if (gs.invincTicks > 0 && Math.floor(gs.invincTicks / 5) % 2 === 0) {
      // skip drawing this frame to create flash effect
    } else {
    const px = gs.pacX * CELL + CELL / 2;
    const py = gs.pacY * CELL + CELL / 2;
    const mouthAngle = 0.25;
    let startAngle = mouthAngle * Math.PI;
    let endAngle = (2 - mouthAngle) * Math.PI;
    if (gs.pacDir === "right" || gs.pacDir === "none") { startAngle = mouthAngle * Math.PI; endAngle = (2 - mouthAngle) * Math.PI; }
    else if (gs.pacDir === "left") { startAngle = (1 + mouthAngle) * Math.PI; endAngle = (3 - mouthAngle) * Math.PI; }
    else if (gs.pacDir === "up") { startAngle = (1.5 + mouthAngle) * Math.PI; endAngle = (3.5 - mouthAngle) * Math.PI; }
    else if (gs.pacDir === "down") { startAngle = (0.5 + mouthAngle) * Math.PI; endAngle = (2.5 - mouthAngle) * Math.PI; }
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, CELL / 2 - 2, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
    } // end invincibility flash check
  }, []);

  const tick = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const gs = gsRef.current;
    gs.tickCount++;

    // Try buffered direction
    if (gs.nextDir !== "none") {
      const res = tryMove(gs.pacX, gs.pacY, gs.nextDir);
      if (res) {
        gs.pacDir = gs.nextDir;
        gs.nextDir = "none";
      }
    }

    // Move pac-man
    if (gs.pacDir !== "none") {
      const res = tryMove(gs.pacX, gs.pacY, gs.pacDir);
      if (res) { gs.pacX = res.x; gs.pacY = res.y; }
    }

    // Eat dot
    if (gs.dots[gs.pacY] && gs.dots[gs.pacY][gs.pacX]) {
      gs.dots[gs.pacY][gs.pacX] = false;
      gs.score += 10;
      setUiScore(gs.score);
    }
    // Eat pellet
    if (gs.pellets[gs.pacY] && gs.pellets[gs.pacY][gs.pacX]) {
      gs.pellets[gs.pacY][gs.pacX] = false;
      gs.score += 50;
      gs.ghosts.forEach((g) => { g.scared = LEVELS[gs.level - 1].scaredDuration; });
      setUiScore(gs.score);
    }

    // Move ghosts (every 2 ticks)
    if (gs.tickCount % 2 === 0) {
      gs.ghosts.forEach((ghost) => {
        if (ghost.scared > 0) ghost.scared--;
        const res = tryMove(ghost.x, ghost.y, ghost.dir);
        if (res) { ghost.x = res.x; ghost.y = res.y; }
        else { ghost.dir = randomDir(ghost); }
        // Random direction change
        if (Math.random() < 0.15) ghost.dir = randomDir(ghost);
      });
    }

    // Invincibility countdown
    if (gs.invincTicks > 0) gs.invincTicks--;

    // Ghost collision
    gs.ghosts.forEach((ghost) => {
      if (ghost.x === gs.pacX && ghost.y === gs.pacY) {
        if (ghost.scared > 0) {
          ghost.scared = 0;
          const positions = GHOST_STARTS.length > 0 ? GHOST_STARTS : [[9, 9]];
          const pos = positions[gs.ghosts.indexOf(ghost) % positions.length];
          ghost.x = pos[1]; ghost.y = pos[0];
          gs.score += 200; setUiScore(gs.score);
        } else if (gs.invincTicks === 0) {
          gs.lives--;
          gs.invincTicks = 80; // ~1.5s of safety after being hit
          setUiLives(gs.lives);
          if (gs.lives <= 0) { setPhase("gameOver"); return; }
          // Reset pac position
          const { pacX, pacY } = parseMaze();
          gs.pacX = pacX; gs.pacY = pacY; gs.pacDir = "none"; gs.nextDir = "none";
        }
      }
    });

    // Check level complete (all dots + pellets eaten)
    const anyDot = gs.dots.some((row) => row.some(Boolean));
    const anyPellet = gs.pellets.some((row) => row.some(Boolean));
    if (!anyDot && !anyPellet) {
      if (gs.level >= LEVELS.length) {
        setPhase("win");
      } else {
        setLevelMsg(`Level ${gs.level} Complete!`);
        setPhase("levelComplete");
        const nextLevelIdx = gs.level;
        const savedScore = gs.score;
        const savedLives = gs.lives;
        setTimeout(() => {
          const newState = buildInitialState(nextLevelIdx);
          newState.score = savedScore;
          newState.lives = savedLives;
          gsRef.current = newState;
          setUiLevel(nextLevelIdx + 1);
          setUiScore(savedScore);
          setUiLives(savedLives);
          setPhase("playing");
        }, 2000);
      }
    }

    drawFrame();
  }, [drawFrame]);

  // RAF loop
  useEffect(() => {
    const loop = (ts: number) => {
      const cfg = LEVELS[gsRef.current.level - 1];
      if (ts - lastTickRef.current >= cfg.tickMs) {
        tick();
        lastTickRef.current = ts;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  // Keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      };
      if (map[e.key]) {
        e.preventDefault();
        gsRef.current.nextDir = map[e.key];
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { drawFrame(); }, [drawFrame]);

  const restartGame = () => {
    gsRef.current = buildInitialState(0);
    setUiScore(0); setUiLives(3); setUiLevel(1);
    setPhase("playing");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Pac-Man</h1>
            <p className="text-slate-400 text-sm">Eat all dots to advance</p>
          </div>
          <div className="bg-slate-700 rounded-xl px-5 py-2 text-center">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Level</div>
            <div className="text-2xl font-bold text-yellow-400">{uiLevel} / {LEVELS.length}</div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800 rounded-lg px-4 py-2 mb-4 text-sm text-slate-300">
          Arrow keys to move · Eat dots · Power pellets (large yellow dots) make ghosts vulnerable
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Game */}
          <div className="flex-1">
            {/* Stats */}
            <div className="flex gap-4 mb-3">
              <div className="bg-slate-800 rounded-lg px-4 py-2 flex-1 text-center">
                <div className="text-xs text-slate-400 uppercase tracking-widest">Score</div>
                <div className="text-xl font-bold text-yellow-400">{uiScore}</div>
              </div>
              <div className="bg-slate-800 rounded-lg px-4 py-2 flex-1 text-center">
                <div className="text-xs text-slate-400 uppercase tracking-widest">Lives</div>
                <div className="text-xl font-bold text-red-400">{"♥".repeat(uiLives)}{"♡".repeat(Math.max(0, 3 - uiLives))}</div>
              </div>
            </div>

            <div className="relative inline-block">
              <canvas
                ref={canvasRef}
                width={COLS * CELL}
                height={ROWS * CELL}
                className="block rounded-lg border-2 border-blue-900"
              />

              {phase === "levelComplete" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 rounded-lg">
                  <div className="text-3xl font-black text-yellow-400 mb-2">{levelMsg}</div>
                  <div className="text-slate-300">Loading next level…</div>
                </div>
              )}
              {phase === "gameOver" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 rounded-lg">
                  <div className="text-4xl font-black text-red-400 mb-2">GAME OVER</div>
                  <div className="text-slate-300 mb-6">Score: {uiScore}</div>
                  <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-lg" onClick={restartGame}>Play Again</button>
                </div>
              )}
              {phase === "win" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 rounded-lg">
                  <div className="text-4xl font-black text-green-400 mb-2">You Win! 🏆</div>
                  <div className="text-slate-300 mb-6">Final Score: {uiScore}</div>
                  <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-lg" onClick={restartGame}>Play Again</button>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="flex-shrink-0 flex flex-col gap-4 items-start">
            <AdPlaceholder />
            <div className="bg-slate-800 rounded-lg p-4 w-full">
              <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wide">Levels</h3>
              {LEVELS.map((lv, i) => (
                <div key={i} className={`flex items-center justify-between py-1 text-sm border-b border-slate-700 last:border-0 ${i + 1 === uiLevel ? "text-yellow-400 font-bold" : "text-slate-500"}`}>
                  <span>Level {i + 1}</span>
                  <span className="text-xs">{lv.numGhosts} ghosts</span>
                  {i + 1 < uiLevel && <span className="text-green-400">✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}