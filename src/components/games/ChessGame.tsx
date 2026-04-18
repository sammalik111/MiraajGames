"use client";

import React, { useMemo, useState } from "react";

const initialBoard = [
  ["r", "n", "b", "q", "k", "b", "n", "r"],
  ["p", "p", "p", "p", "p", "p", "p", "p"],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["P", "P", "P", "P", "P", "P", "P", "P"],
  ["R", "N", "B", "Q", "K", "B", "N", "R"],
];

const pieceLabels: Record<string, string> = {
  r: "♜",
  n: "♞",
  b: "♝",
  q: "♛",
  k: "♚",
  p: "♟︎",
  R: "♖",
  N: "♘",
  B: "♗",
  Q: "♕",
  K: "♔",
  P: "♙",
};

export default function ChessGame() {
  const [board, setBoard] = useState<string[][]>(initialBoard);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [message, setMessage] = useState("Click a piece and then a target square to move it.");

  const handleCellClick = (row: number, col: number) => {
    const piece = board[row][col];

    if (selected && (selected.row !== row || selected.col !== col)) {
      const updated = board.map((line) => [...line]);
      updated[row][col] = board[selected.row][selected.col];
      updated[selected.row][selected.col] = "";
      setBoard(updated);
      setMessage(`Moved ${pieceLabels[board[selected.row][selected.col]] || "piece"} to ${String.fromCharCode(97 + col)}${8 - row}`);
      setSelected(null);
      return;
    }

    if (piece) {
      setSelected({ row, col });
      setMessage(`Selected ${pieceLabels[piece]} at ${String.fromCharCode(97 + col)}${8 - row}`);
    }
  };

  const status = selected ? "Piece selected" : "Ready to move";

  return (
    <div className="space-y-6 w-full max-w-2xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Chess Master</h2>
        <p className="mt-2 text-slate-400">A simple board demo. Select a piece and click a square to move it.</p>
      </div>

      <div className="grid gap-1 rounded-[2rem] border border-slate-800 bg-slate-900 p-2 shadow-inner shadow-slate-950/30">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-8 gap-1">
            {row.map((cell, colIndex) => {
              const isSelected = selected?.row === rowIndex && selected?.col === colIndex;
              const isDark = (rowIndex + colIndex) % 2 === 1;
              return (
                <button
                  key={colIndex}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  className={`aspect-square rounded-2xl text-2xl font-semibold transition ${isDark ? "bg-slate-800" : "bg-slate-700"} ${isSelected ? "ring-2 ring-violet-400" : "hover:ring-2 hover:ring-slate-500"}`}
                >
                  {cell ? pieceLabels[cell] : ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          <p>Status: {status}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      </div>
    </div>
  );
}
