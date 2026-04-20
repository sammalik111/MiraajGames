"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ── Constants ──────────────────────────────────────────────────────────────

const STAGE_W = 580;
const STAGE_H = 480;
const INVADER_W = 26;
const INVADER_H = 20;
const H_GAP = 14;
const V_GAP = 12;
const PLAYER_W = 40;
const PLAYER_H = 16;
const PLAYER_SPEED = 5;
const PLAYER_BULLET_SPEED = 7;
const ENEMY_BULLET_SPEED = 3.5;
const BULLET_W = 4;
const BULLET_H = 10;

const ROW_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6"];

interface LevelDef {
  rows: number;
  cols: number;
  moveFrames: number;
  enemyShootInterval: number;
}

const LEVELS: LevelDef[] = [
  { rows: 3, cols: 8, moveFrames: 28, enemyShootInterval: 80 },
  { rows: 4, cols: 9, moveFrames: 22, enemyShootInterval: 60 },
  { rows: 4, cols: 10, moveFrames: 16, enemyShootInterval: 45 },
];

// ── Types ──────────────────────────────────────────────────────────────────

interface Invader {
  row: number;
  col: number;
  x: number;
  y: number;
  alive: boolean;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  fromPlayer: boolean;
}

interface GameState {
  invaders: Invader[];
  playerX: number;
  playerBullets: Bullet[];
  enemyBullets: Bullet[];
  lives: number;
  score: number;
  moveDir: 1 | -1;
  frameCount: number;
  bulletIdCounter: number;
  level: number; // 1-based
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

// ── Invader builder ────────────────────────────────────────────────────────

function buildInvaders(level: LevelDef): Invader[] {
  const invaders: Invader[] = [];
  const totalW = level.cols * (INVADER_W + H_GAP) - H_GAP;
  const startX = Math.floor((STAGE_W - totalW) / 2);
  const startY = 60;
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) {
      invaders.push({
        row,
        col,
        x: startX + col * (INVADER_W + H_GAP),
        y: startY + row * (INVADER_H + V_GAP),
        alive: true,
      });
    }
  }
  return invaders;
}

function buildInitialState(levelIdx: number): GameState {
  const level = LEVELS[levelIdx];
  return {
    invaders: buildInvaders(level),
    playerX: STAGE_W / 2 - PLAYER_W / 2,
    playerBullets: [],
    enemyBullets: [],
    lives: 3,
    score: 0,
    moveDir: 1,
    frameCount: 0,
    bulletIdCounter: 0,
    level: levelIdx + 1,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SpaceInvadersGame() {
  const [uiLevel, setUiLevel] = useState(1);
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(3);
  const [phase, setPhase] = useState<"playing" | "levelClear" | "gameOver" | "win">("playing");
  const [levelClearMsg, setLevelClearMsg] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GameState>(buildInitialState(0));
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<"playing" | "levelClear" | "gameOver" | "win">("playing");
  const canShootRef = useRef(true);

  phaseRef.current = phase;

  const startLevel = useCallback((levelIdx: number) => {
    gsRef.current = buildInitialState(levelIdx);
    canShootRef.current = true;
    setUiLevel(levelIdx + 1);
    setUiScore(0);
    setUiLives(3);
    setPhase("playing");
  }, []);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gs = gsRef.current;

    // Clear
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);

    // Ground line
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(0, STAGE_H - 2, STAGE_W, 2);

    // Invaders
    gs.invaders.forEach((inv) => {
      if (!inv.alive) return;
      ctx.fillStyle = ROW_COLORS[inv.row % ROW_COLORS.length];
      ctx.fillRect(inv.x, inv.y, INVADER_W, INVADER_H);
      // eyes
      ctx.fillStyle = "#000";
      ctx.fillRect(inv.x + 4, inv.y + 4, 5, 5);
      ctx.fillRect(inv.x + INVADER_W - 9, inv.y + 4, 5, 5);
      // antennae
      ctx.strokeStyle = ROW_COLORS[inv.row % ROW_COLORS.length];
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(inv.x + 6, inv.y); ctx.lineTo(inv.x + 3, inv.y - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(inv.x + INVADER_W - 6, inv.y); ctx.lineTo(inv.x + INVADER_W - 3, inv.y - 5); ctx.stroke();
    });

    // Player
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(gs.playerX, STAGE_H - PLAYER_H - 10, PLAYER_W, PLAYER_H);
    // Cannon tip
    ctx.fillStyle = "#93c5fd";
    ctx.fillRect(gs.playerX + PLAYER_W / 2 - 3, STAGE_H - PLAYER_H - 18, 6, 10);

    // Player bullets
    ctx.fillStyle = "#fde047";
    gs.playerBullets.forEach((b) => ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H));

    // Enemy bullets
    ctx.fillStyle = "#f87171";
    gs.enemyBullets.forEach((b) => ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H));
  }, []);

  const tick = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const gs = gsRef.current;
    const levelDef = LEVELS[gs.level - 1];
    gs.frameCount++;

    // Move player
    if (keysRef.current.has("ArrowLeft") && gs.playerX > 0) {
      gs.playerX = Math.max(0, gs.playerX - PLAYER_SPEED);
    }
    if (keysRef.current.has("ArrowRight") && gs.playerX + PLAYER_W < STAGE_W) {
      gs.playerX = Math.min(STAGE_W - PLAYER_W, gs.playerX + PLAYER_SPEED);
    }

    // Player shoot
    if (keysRef.current.has(" ") && canShootRef.current && gs.playerBullets.length < 3) {
      canShootRef.current = false;
      gs.playerBullets.push({
        id: gs.bulletIdCounter++,
        x: gs.playerX + PLAYER_W / 2 - BULLET_W / 2,
        y: STAGE_H - PLAYER_H - 20,
        fromPlayer: true,
      });
      setTimeout(() => { canShootRef.current = true; }, 300);
    }

    // Move invaders
    if (gs.frameCount % levelDef.moveFrames === 0) {
      const alive = gs.invaders.filter((i) => i.alive);
      if (alive.length === 0) return;
      const minX = Math.min(...alive.map((i) => i.x));
      const maxX = Math.max(...alive.map((i) => i.x + INVADER_W));
      let drop = false;
      if (gs.moveDir === 1 && maxX >= STAGE_W - 2) { gs.moveDir = -1; drop = true; }
      if (gs.moveDir === -1 && minX <= 2) { gs.moveDir = 1; drop = true; }
      gs.invaders.forEach((inv) => {
        if (!inv.alive) return;
        inv.x += gs.moveDir * 18;
        if (drop) inv.y += 14;
      });
    }

    // Enemy shoot
    if (gs.frameCount % levelDef.enemyShootInterval === 0) {
      const alive = gs.invaders.filter((i) => i.alive);
      if (alive.length > 0) {
        // Pick random bottom invader per column
        const colMap = new Map<number, Invader>();
        alive.forEach((inv) => {
          const existing = colMap.get(inv.col);
          if (!existing || inv.row > existing.row) colMap.set(inv.col, inv);
        });
        const shooters = Array.from(colMap.values());
        const shooter = shooters[Math.floor(Math.random() * shooters.length)];
        gs.enemyBullets.push({
          id: gs.bulletIdCounter++,
          x: shooter.x + INVADER_W / 2 - BULLET_W / 2,
          y: shooter.y + INVADER_H,
          fromPlayer: false,
        });
      }
    }

    // Move bullets
    gs.playerBullets = gs.playerBullets.filter((b) => b.y > -BULLET_H).map((b) => ({ ...b, y: b.y - PLAYER_BULLET_SPEED }));
    gs.enemyBullets = gs.enemyBullets.filter((b) => b.y < STAGE_H + BULLET_H).map((b) => ({ ...b, y: b.y + ENEMY_BULLET_SPEED }));

    // Collision: player bullets vs invaders
    gs.playerBullets = gs.playerBullets.filter((bullet) => {
      for (const inv of gs.invaders) {
        if (!inv.alive) continue;
        if (
          bullet.x < inv.x + INVADER_W &&
          bullet.x + BULLET_W > inv.x &&
          bullet.y < inv.y + INVADER_H &&
          bullet.y + BULLET_H > inv.y
        ) {
          inv.alive = false;
          gs.score += 10;
          setUiScore(gs.score);
          return false;
        }
      }
      return true;
    });

    // Collision: enemy bullets vs player
    const playerY = STAGE_H - PLAYER_H - 10;
    gs.enemyBullets = gs.enemyBullets.filter((bullet) => {
      if (
        bullet.x < gs.playerX + PLAYER_W &&
        bullet.x + BULLET_W > gs.playerX &&
        bullet.y < playerY + PLAYER_H &&
        bullet.y + BULLET_H > playerY
      ) {
        gs.lives--;
        setUiLives(gs.lives);
        if (gs.lives <= 0) {
          setPhase("gameOver");
        }
        return false;
      }
      return true;
    });

    // Check level clear
    if (gs.invaders.every((i) => !i.alive)) {
      const bonus = 500;
      gs.score += bonus;
      setUiScore(gs.score);
      if (gs.level >= LEVELS.length) {
        setPhase("win");
      } else {
        const msg = `LEVEL ${gs.level} CLEAR! +${bonus} pts`;
        setLevelClearMsg(msg);
        setPhase("levelClear");
        const nextLevelIdx = gs.level; // current level is 1-based, so next index = gs.level
        setTimeout(() => {
          gsRef.current = {
            ...buildInitialState(nextLevelIdx),
            score: gs.score,
            lives: gs.lives,
          };
          setUiLevel(nextLevelIdx + 1);
          setUiLives(gs.lives);
          setUiScore(gs.score);
          canShootRef.current = true;
          setPhase("playing");
        }, 2000);
      }
    }

    // Invaders reach bottom
    const aliveInvaders = gs.invaders.filter((i) => i.alive);
    if (aliveInvaders.some((i) => i.y + INVADER_H >= STAGE_H - PLAYER_H - 12)) {
      gs.lives = 0;
      setUiLives(0);
      setPhase("gameOver");
    }

    drawFrame();
  }, [drawFrame]);

  // RAF loop
  useEffect(() => {
    const loop = () => {
      tick();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  // Key handlers
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", " ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
    };
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  // Initial draw
  useEffect(() => { drawFrame(); }, [drawFrame]);

  return (
    <div className="min-h-screen bg-slate-900 text-white py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Space Invaders</h1>
            <p className="text-slate-400 text-sm">Clear all invaders to advance</p>
          </div>
          <div className="bg-slate-700 rounded-xl px-5 py-2 text-center">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Level</div>
            <div className="text-2xl font-bold text-yellow-400">{uiLevel} / {LEVELS.length}</div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800 rounded-lg px-4 py-2 mb-4 text-sm text-slate-300 flex flex-wrap gap-4">
          <span>← → Arrow keys to move</span>
          <span>•</span>
          <span>Space to shoot</span>
          <span>•</span>
          <span>Destroy all invaders to advance</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Game */}
          <div className="flex-1">
            {/* Stats bar */}
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

            <div className="relative">
              <canvas
                ref={canvasRef}
                width={STAGE_W}
                height={STAGE_H}
                className="block rounded-lg border-2 border-slate-600"
                style={{ background: "#0f172a" }}
              />

              {/* Level clear overlay */}
              {phase === "levelClear" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 rounded-lg">
                  <div className="text-4xl font-black text-yellow-400 mb-2">{levelClearMsg}</div>
                  <div className="text-slate-300">Loading next level…</div>
                </div>
              )}

              {/* Game over overlay */}
              {phase === "gameOver" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 rounded-lg">
                  <div className="text-4xl font-black text-red-400 mb-2">GAME OVER</div>
                  <div className="text-slate-300 mb-6">Score: {uiScore}</div>
                  <button
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-lg transition"
                    onClick={() => startLevel(0)}
                  >
                    Play Again
                  </button>
                </div>
              )}

              {/* Win overlay */}
              {phase === "win" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 rounded-lg">
                  <div className="text-4xl font-black text-green-400 mb-2">YOU WIN! 🏆</div>
                  <div className="text-slate-300 mb-6">Final Score: {uiScore}</div>
                  <button
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-lg transition"
                    onClick={() => startLevel(0)}
                  >
                    Play Again
                  </button>
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
                <div
                  key={i}
                  className={`flex items-center justify-between py-1 text-sm border-b border-slate-700 last:border-0 ${
                    i + 1 === uiLevel ? "text-yellow-400 font-bold" : "text-slate-500"
                  }`}
                >
                  <span>Level {i + 1}</span>
                  <span className="text-xs">{lv.rows}×{lv.cols}</span>
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