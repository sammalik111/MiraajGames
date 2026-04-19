"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

const COLS = 10;
const ROWS = 20;
const CELL = 22;

type Cell = number; // 0 empty, 1..7 piece color
type Shape = number[][];

const SHAPES: { shape: Shape; color: string; id: number }[] = [
  { id: 1, shape: [[1, 1, 1, 1]], color: "#22d3ee" },
  { id: 2, shape: [[1, 1], [1, 1]], color: "#facc15" },
  { id: 3, shape: [[0, 1, 0], [1, 1, 1]], color: "#a855f7" },
  { id: 4, shape: [[0, 1, 1], [1, 1, 0]], color: "#22c55e" },
  { id: 5, shape: [[1, 1, 0], [0, 1, 1]], color: "#ef4444" },
  { id: 6, shape: [[1, 0, 0], [1, 1, 1]], color: "#3b82f6" },
  { id: 7, shape: [[0, 0, 1], [1, 1, 1]], color: "#f97316" },
];

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function rotate(shape: Shape): Shape {
  const h = shape.length, w = shape[0].length;
  const out: Shape = Array.from({ length: w }, () => Array(h).fill(0));
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) out[c][h - 1 - r] = shape[r][c];
  return out;
}

type Piece = { shape: Shape; row: number; col: number; id: number };

function spawnPiece(): Piece {
  const def = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const shape = def.shape.map((r) => [...r]);
  return { shape, row: 0, col: Math.floor((COLS - shape[0].length) / 2), id: def.id };
}

function collides(board: Cell[][], p: Piece, dRow = 0, dCol = 0, shape?: Shape) {
  const s = shape || p.shape;
  for (let r = 0; r < s.length; r++) {
    for (let c = 0; c < s[r].length; c++) {
      if (!s[r][c]) continue;
      const nr = p.row + r + dRow;
      const nc = p.col + c + dCol;
      if (nc < 0 || nc >= COLS || nr >= ROWS) return true;
      if (nr >= 0 && board[nr][nc]) return true;
    }
  }
  return false;
}

function merge(board: Cell[][], p: Piece): Cell[][] {
  const out = board.map((r) => [...r]);
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (p.shape[r][c] && p.row + r >= 0) out[p.row + r][p.col + c] = p.id;
    }
  }
  return out;
}

function clearLines(board: Cell[][]): { board: Cell[][]; cleared: number } {
  const kept = board.filter((row) => row.some((c) => !c));
  const cleared = ROWS - kept.length;
  const empties: Cell[][] = Array.from({ length: cleared }, () => Array(COLS).fill(0));
  return { board: [...empties, ...kept], cleared };
}

const COLOR_BY_ID: Record<number, string> = Object.fromEntries(SHAPES.map((s) => [s.id, s.color]));

export default function TetrisGame() {
  const [board, setBoard] = useState<Cell[][]>(emptyBoard);
  const [piece, setPiece] = useState<Piece>(spawnPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  boardRef.current = board;
  pieceRef.current = piece;

  const reset = () => {
    setBoard(emptyBoard());
    setPiece(spawnPiece());
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
  };

  const tryMove = useCallback((dRow: number, dCol: number) => {
    const p = pieceRef.current;
    if (collides(boardRef.current, p, dRow, dCol)) return false;
    setPiece({ ...p, row: p.row + dRow, col: p.col + dCol });
    return true;
  }, []);

  const tryRotate = useCallback(() => {
    const p = pieceRef.current;
    const rotated = rotate(p.shape);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(boardRef.current, p, 0, kick, rotated)) {
        setPiece({ ...p, shape: rotated, col: p.col + kick });
        return;
      }
    }
  }, []);

  const lockPiece = useCallback(() => {
    const p = pieceRef.current;
    const merged = merge(boardRef.current, p);
    const { board: cleared, cleared: n } = clearLines(merged);
    setBoard(cleared);
    if (n) {
      setScore((s) => s + [0, 40, 100, 300, 1200][n] * level);
      setLines((l) => {
        const nl = l + n;
        setLevel(Math.floor(nl / 10) + 1);
        return nl;
      });
    }
    const next = spawnPiece();
    if (collides(cleared, next)) {
      setGameOver(true);
    } else {
      setPiece(next);
    }
  }, [level]);

  const hardDrop = useCallback(() => {
    let d = 0;
    while (!collides(boardRef.current, pieceRef.current, d + 1, 0)) d++;
    const p = pieceRef.current;
    setPiece({ ...p, row: p.row + d });
    setTimeout(() => lockPiece(), 0);
  }, [lockPiece]);

  useEffect(() => {
    if (gameOver || paused) return;
    const interval = Math.max(100, 600 - (level - 1) * 50);
    const t = window.setInterval(() => {
      if (!tryMove(1, 0)) lockPiece();
    }, interval);
    return () => window.clearInterval(t);
  }, [gameOver, paused, level, tryMove, lockPiece]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(e.key)) e.preventDefault();
      if (gameOver) return;
      if (e.key === "p" || e.key === "P") { setPaused((p) => !p); return; }
      if (paused) return;
      if (e.key === "ArrowLeft") tryMove(0, -1);
      else if (e.key === "ArrowRight") tryMove(0, 1);
      else if (e.key === "ArrowDown") { if (!tryMove(1, 0)) lockPiece(); }
      else if (e.key === "ArrowUp") tryRotate();
      else if (e.key === " ") hardDrop();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [gameOver, paused, tryMove, tryRotate, hardDrop, lockPiece]);

  const display = board.map((row) => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c] && piece.row + r >= 0) display[piece.row + r][piece.col + c] = piece.id;
    }
  }

  return (
    <div className="space-y-6 w-full max-w-xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Tetris</h2>
        <p className="mt-2 text-slate-400">Arrows to move, up to rotate, space for hard drop, P to pause.</p>
      </div>

      <div className="flex gap-4">
        <div
          className="inline-grid rounded-xl border border-slate-800 bg-slate-950 p-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gridAutoRows: `${CELL}px` }}
        >
          {display.flatMap((row, r) =>
            row.map((v, c) => (
              <div
                key={`${r}-${c}`}
                className="border border-slate-900"
                style={{ width: CELL, height: CELL, background: v ? COLOR_BY_ID[v] : "#0f172a" }}
              />
            ))
          )}
        </div>

        <div className="flex flex-col gap-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3">
            <p>Score: {score}</p>
            <p>Lines: {lines}</p>
            <p>Level: {level}</p>
          </div>
          <button
            onClick={() => setPaused((p) => !p)}
            className="rounded-2xl bg-sky-500 px-4 py-2 font-semibold text-white hover:bg-sky-400"
            disabled={gameOver}
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={reset}
            className="rounded-2xl bg-violet-500 px-4 py-2 font-semibold text-white hover:bg-violet-400"
          >
            New Game
          </button>
          {gameOver && <p className="rounded-2xl border border-rose-700 bg-rose-950/60 px-4 py-2 text-rose-300">Game Over</p>}
        </div>
      </div>
    </div>
  );
}