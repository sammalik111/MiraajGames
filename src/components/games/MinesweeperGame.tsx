"use client";

import React, { useMemo, useState } from "react";

// -----------------------------------------------------------------------------
// Minesweeper — randomized board
//
// 10x10 board with 15 mines placed at random on each new game. Left-click a
// cell to reveal; clicking an empty cell flood-fills neighbors. Right-click
// (or long-press) to toggle a flag. Reveal every non-mine cell to win.
// -----------------------------------------------------------------------------

const ROWS = 10;
const COLS = 10;
const MINES = 15;

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

function makeBoard(): Cell[] {
  const cells: Cell[] = Array.from({ length: ROWS * COLS }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    adjacent: 0,
  }));

  // random mine placement
  const indices = Array.from({ length: ROWS * COLS }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let i = 0; i < MINES; i++) cells[indices[i]].mine = true;

  // adjacency counts
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      if (cells[idx].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          if (cells[nr * COLS + nc].mine) count++;
        }
      }
      cells[idx].adjacent = count;
    }
  }
  return cells;
}

function floodReveal(cells: Cell[], start: number): Cell[] {
  const out = cells.map((c) => ({ ...c }));
  const stack = [start];
  while (stack.length > 0) {
    const idx = stack.pop()!;
    const cell = out[idx];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (cell.adjacent !== 0) continue;
    const r = Math.floor(idx / COLS);
    const c = idx % COLS;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const n = nr * COLS + nc;
        if (!out[n].revealed && !out[n].flagged && !out[n].mine) stack.push(n);
      }
    }
  }
  return out;
}

export default function MinesweeperGame() {
  const [cells, setCells] = useState<Cell[]>(() => makeBoard());
  const [state, setState] = useState<"playing" | "lost" | "won">("playing");

  const flagCount = useMemo(() => cells.filter((c) => c.flagged).length, [cells]);

  const reset = () => {
    setCells(makeBoard());
    setState("playing");
  };

  const checkWin = (next: Cell[]) => {
    const remaining = next.filter((c) => !c.mine && !c.revealed).length;
    return remaining === 0;
  };

  const handleReveal = (idx: number) => {
    if (state !== "playing") return;
    const cell = cells[idx];
    if (cell.revealed || cell.flagged) return;
    if (cell.mine) {
      const next = cells.map((c) => (c.mine ? { ...c, revealed: true } : c));
      setCells(next);
      setState("lost");
      return;
    }
    const next = floodReveal(cells, idx);
    setCells(next);
    if (checkWin(next)) setState("won");
  };

  const handleFlag = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    if (state !== "playing") return;
    const cell = cells[idx];
    if (cell.revealed) return;
    const next = cells.map((c, i) => (i === idx ? { ...c, flagged: !c.flagged } : c));
    setCells(next);
  };

  const numberColor = (n: number) => {
    const colors = ["", "text-blue-600", "text-green-600", "text-red-600", "text-purple-700", "text-yellow-700", "text-cyan-600", "text-black", "text-zinc-500"];
    return colors[n] || "";
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <h1 className="text-3xl font-bold text-black dark:text-white">Minesweeper</h1>
      <div className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 h-7">
        {state === "won" && <span className="text-green-600">🎉 You cleared the field!</span>}
        {state === "lost" && <span className="text-red-600">💥 Boom! You hit a mine.</span>}
        {state === "playing" && <span>Mines: {MINES - flagCount} · Flagged: {flagCount}</span>}
      </div>

      <div
        className="grid gap-0.5 bg-zinc-400 dark:bg-zinc-700 p-1 rounded-md select-none"
        style={{ gridTemplateColumns: `repeat(${COLS}, 2rem)` }}
      >
        {cells.map((cell, i) => {
          const base = "h-8 w-8 flex items-center justify-center text-sm font-bold rounded-sm";
          let cls = base;
          let content: React.ReactNode = "";
          if (cell.revealed) {
            if (cell.mine) {
              cls += " bg-red-500 text-white";
              content = "💣";
            } else {
              cls += " bg-zinc-100 dark:bg-zinc-200 text-black";
              if (cell.adjacent > 0) content = <span className={numberColor(cell.adjacent)}>{cell.adjacent}</span>;
            }
          } else {
            cls += " bg-zinc-300 dark:bg-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-400 cursor-pointer";
            if (cell.flagged) content = "🚩";
          }
          return (
            <button
              key={i}
              onClick={() => handleReveal(i)}
              onContextMenu={(e) => handleFlag(e, i)}
              disabled={state !== "playing" && !cell.revealed}
              className={cls}
            >
              {content}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">Left-click to reveal · Right-click to flag</p>

      <button
        onClick={reset}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
      >
        New Game
      </button>
    </div>
  );
}