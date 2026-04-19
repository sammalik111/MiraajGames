"use client";

import React, { useEffect, useState } from "react";

// -----------------------------------------------------------------------------
// Tic Tac Toe
//
// You are X; computer is O. "Medium" AI logic:
//   1. If there's a winning move, take it.
//   2. If the opponent has a winning move, block it.
//   3. Otherwise, take the center, then a corner, then a side.
//   4. ~20% of the time, pick a random legal move instead so it's beatable.
// -----------------------------------------------------------------------------

type Cell = "X" | "O" | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winner(b: Cell[]): Cell {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

function findWinningMove(b: Cell[], player: "X" | "O"): number | null {
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    const next = [...b];
    next[i] = player;
    if (winner(next) === player) return i;
  }
  return null;
}

function aiPick(b: Cell[]): number {
  // 20% chance of a random move for beatability
  if (Math.random() < 0.2) {
    const empties = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    return empties[Math.floor(Math.random() * empties.length)];
  }
  // win if possible
  const win = findWinningMove(b, "O");
  if (win !== null) return win;
  // block X's win
  const block = findWinningMove(b, "X");
  if (block !== null) return block;
  // preference order: center, corners, sides
  const order = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  for (const i of order) if (!b[i]) return i;
  return 0; // unreachable
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [xTurn, setXTurn] = useState(true);

  const w = winner(board);
  const full = board.every((c) => c !== null);
  const done = w !== null || full;

  // Computer plays O whenever it's O's turn.
  useEffect(() => {
    if (done || xTurn) return;
    const id = setTimeout(() => {
      const pick = aiPick(board);
      setBoard((prev) => {
        if (prev[pick]) return prev; // safety
        const next = [...prev];
        next[pick] = "O";
        return next;
      });
      setXTurn(true);
    }, 400);
    return () => clearTimeout(id);
  }, [xTurn, done, board]);

  const handleClick = (i: number) => {
    if (done || !xTurn || board[i]) return;
    const next = [...board];
    next[i] = "X";
    setBoard(next);
    setXTurn(false);
  };

  const reset = () => {
    setBoard(Array(9).fill(null));
    setXTurn(true);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <h1 className="text-3xl font-bold text-black dark:text-white">Tic Tac Toe</h1>

      <div className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 h-7">
        {w === "X" && <span className="text-green-600">🎉 You win!</span>}
        {w === "O" && <span className="text-red-600">Computer wins.</span>}
        {!w && full && <span className="text-yellow-600">Draw.</span>}
        {!done && <span>{xTurn ? "Your turn (X)" : "Computer thinking..."}</span>}
      </div>

      <div className="grid grid-cols-3 gap-2 bg-zinc-200 dark:bg-zinc-700 p-2 rounded-lg">
        {board.map((v, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={!xTurn || done || v !== null}
            className="w-20 h-20 bg-white dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-600 text-3xl font-bold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:cursor-not-allowed"
          >
            {v === "X" && <span className="text-blue-600">X</span>}
            {v === "O" && <span className="text-red-600">O</span>}
          </button>
        ))}
      </div>

      <button
        onClick={reset}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
      >
        Reset
      </button>
    </div>
  );
}