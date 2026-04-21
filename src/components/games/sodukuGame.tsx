"use client";

import React, { useMemo, useState } from "react";

// -----------------------------------------------------------------------------
// Sudoku — randomized puzzle
//
// Builds a fresh solved 9x9 grid with backtracking + randomized digit order,
// then removes ~45 cells to create the puzzle. Locked (given) cells can't be
// edited; editable cells turn red if they conflict with a row/column/box.
// -----------------------------------------------------------------------------

const N = 9;

type Grid = number[]; // length 81, 0 = empty

function cloneGrid(g: Grid): Grid {
  return g.slice();
}

function isValid(g: Grid, r: number, c: number, v: number): boolean {
  for (let i = 0; i < N; i++) {
    if (g[r * N + i] === v) return false;
    if (g[i * N + c] === v) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (g[(br + i) * N + (bc + j)] === v) return false;
    }
  }
  return true;
}

function shuffled<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fillGrid(g: Grid): boolean {
  for (let i = 0; i < N * N; i++) {
    if (g[i] !== 0) continue;
    const r = Math.floor(i / N);
    const c = i % N;
    for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (isValid(g, r, c, v)) {
        g[i] = v;
        if (fillGrid(g)) return true;
        g[i] = 0;
      }
    }
    return false;
  }
  return true;
}

function makePuzzle(): { puzzle: Grid; solution: Grid } {
  const solution: Grid = Array(81).fill(0);
  fillGrid(solution);
  const puzzle = cloneGrid(solution);
  // remove ~45 cells
  const indices = shuffled(Array.from({ length: 81 }, (_, i) => i));
  for (let i = 0; i < 45; i++) puzzle[indices[i]] = 0;
  return { puzzle, solution };
}

export default function SudokuGame() {
  const [game, setGame] = useState(() => {
    const { puzzle, solution } = makePuzzle();
    return { puzzle, solution, values: cloneGrid(puzzle), selected: -1 };
  });
  const [won, setWon] = useState(false);

  const reset = () => {
    const { puzzle, solution } = makePuzzle();
    setGame({ puzzle, solution, values: cloneGrid(puzzle), selected: -1 });
    setWon(false);
  };

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    const { values } = game;
    for (let i = 0; i < 81; i++) {
      const v = values[i];
      if (v === 0) continue;
      const r = Math.floor(i / N);
      const c = i % N;
      for (let k = 0; k < N; k++) {
        const rowIdx = r * N + k;
        const colIdx = k * N + c;
        if (rowIdx !== i && values[rowIdx] === v) bad.add(i);
        if (colIdx !== i && values[colIdx] === v) bad.add(i);
      }
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) {
          const idx = (br + a) * N + (bc + b);
          if (idx !== i && values[idx] === v) bad.add(i);
        }
      }
    }
    return bad;
  }, [game]);

  const setCell = (idx: number, v: number) => {
    if (won) return;
    if (game.puzzle[idx] !== 0) return;
    const next = cloneGrid(game.values);
    next[idx] = v;
    const newGame = { ...game, values: next };
    setGame(newGame);
    if (next.every((x, i) => x === game.solution[i])) setWon(true);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (game.selected < 0) return;
    if (e.key >= "1" && e.key <= "9") setCell(game.selected, parseInt(e.key, 10));
    else if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") setCell(game.selected, 0);
  };

  return (
    <div className="flex flex-col items-center gap-5" tabIndex={0} onKeyDown={handleKey}>
      <h1 className="text-3xl font-bold text-black dark:text-white">Sudoku</h1>
      <div className="text-lg font-semibold h-7">
        {won ? <span className="text-green-600">🎉 Solved!</span> : <span className="text-zinc-600 dark:text-zinc-300">Click a cell then type 1–9.</span>}
      </div>

      <div className="grid grid-cols-9 border-2 border-black dark:border-white">
        {game.values.map((v, i) => {
          const r = Math.floor(i / N);
          const c = i % N;
          const given = game.puzzle[i] !== 0;
          const selected = game.selected === i;
          const bad = conflicts.has(i);
          const borderR = c % 3 === 2 && c !== N - 1 ? "border-r-2 border-r-black dark:border-r-white" : "border-r border-r-zinc-400";
          const borderB = r % 3 === 2 && r !== N - 1 ? "border-b-2 border-b-black dark:border-b-white" : "border-b border-b-zinc-400";
          let bg = "bg-white dark:bg-zinc-800";
          if (selected) bg = "bg-blue-200 dark:bg-blue-900";
          else if (bad) bg = "bg-red-200 dark:bg-red-900";
          const textColor = given ? "text-black dark:text-white font-bold" : "text-blue-600 dark:text-blue-400";
          return (
            <button
              key={i}
              onClick={() => setGame({ ...game, selected: i })}
              className={`h-10 w-10 text-lg ${bg} ${borderR} ${borderB} ${textColor}`}
            >
              {v === 0 ? "" : v}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => game.selected >= 0 && setCell(game.selected, n)}
            className="h-10 w-10 rounded-md bg-zinc-200 dark:bg-zinc-700 text-lg font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-600"
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => game.selected >= 0 && setCell(game.selected, 0)}
          className="h-10 rounded-md bg-zinc-200 dark:bg-zinc-700 px-3 text-sm font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-600"
        >
          Erase
        </button>
      </div>

      <button
        onClick={reset}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
      >
        New Puzzle
      </button>
    </div>
  );
}