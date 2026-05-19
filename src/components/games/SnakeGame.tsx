"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";

const COLS = 20;
const ROWS = 20;
const CELL = 20;
const W = COLS * CELL;
const H = ROWS * CELL;
// Tick = ms between snake moves. Lower = faster.
// 160ms at score 0 → 110ms cap reached around score 17.
const TICK_START = 160;
const TICK_MIN = 110;
const TICK_PER_SCORE = 3;

type Cell = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";

const DIRS: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function randFood(snake: Cell[]): Cell {
  while (true) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * ROWS);
    if (!snake.some((s) => s.x === x && s.y === y)) return { x, y };
  }
}

export default function SnakeGame({ onGameEnd }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [dead, setDead] = useState(false);

  const snakeRef = useRef<Cell[]>([{ x: 10, y: 10 }]);
  const dirRef = useRef<Dir>("right");
  const queuedDirRef = useRef<Dir | null>(null);
  const foodRef = useRef<Cell>({ x: 5, y: 5 });
  const endedRef = useRef(false);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = "#1a1a25";
    ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, H);
      ctx.stroke();
    }
    for (let i = 1; i < ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(W, i * CELL);
      ctx.stroke();
    }
    // food
    const f = foodRef.current;
    ctx.fillStyle = "#ff2a6d";
    ctx.shadowColor = "#ff2a6d";
    ctx.shadowBlur = 10;
    ctx.fillRect(f.x * CELL + 3, f.y * CELL + 3, CELL - 6, CELL - 6);
    ctx.shadowBlur = 0;
    // snake
    snakeRef.current.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? "#00f0ff" : "#00a8b8";
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }, []);

  const tick = useCallback(() => {
    if (queuedDirRef.current) {
      const q = queuedDirRef.current;
      if (q !== OPPOSITE[dirRef.current]) dirRef.current = q;
      queuedDirRef.current = null;
    }
    const d = DIRS[dirRef.current];
    const head = snakeRef.current[0];
    const next = { x: head.x + d.x, y: head.y + d.y };
    // wall
    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      setDead(true);
      setRunning(false);
      return;
    }
    // self
    if (snakeRef.current.some((s) => s.x === next.x && s.y === next.y)) {
      setDead(true);
      setRunning(false);
      return;
    }
    const ate = next.x === foodRef.current.x && next.y === foodRef.current.y;
    const newSnake = [next, ...snakeRef.current];
    if (!ate) newSnake.pop();
    snakeRef.current = newSnake;
    if (ate) {
      setScore((s) => s + 1);
      foodRef.current = randFood(newSnake);
    }
    draw();
  }, [draw]);

  useEffect(() => {
    if (!running) return;
    const speed = Math.max(TICK_MIN, TICK_START - score * TICK_PER_SCORE);
    const id = window.setInterval(tick, speed);
    return () => window.clearInterval(id);
  }, [running, tick, score]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "w") queuedDirRef.current = "up";
      else if (k === "arrowdown" || k === "s") queuedDirRef.current = "down";
      else if (k === "arrowleft" || k === "a") queuedDirRef.current = "left";
      else if (k === "arrowright" || k === "d") queuedDirRef.current = "right";
      else return;
      e.preventDefault();
      if (!running && !dead) setRunning(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, dead]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (dead && !endedRef.current) {
      endedRef.current = true;
      onGameEnd(score, { length: snakeRef.current.length });
    }
  }, [dead, score, onGameEnd]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        Score <span className="text-[color:var(--neon-cyan)]">{score}</span> · Length{" "}
        {snakeRef.current.length}
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="border border-[color:var(--border-strong)]"
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        {dead
          ? "▸ game over"
          : running
            ? "WASD / arrows · don't eat yourself"
            : "press any direction to start"}
      </p>
    </div>
  );
}
