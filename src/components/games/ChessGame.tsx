"use client";

import React, { useEffect, useState } from "react";

type Board = string[][];
type Pos = { row: number; col: number };

const initialBoard: Board = [
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
  r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟︎",
  R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔", P: "♙",
};

const isWhite = (p: string) => p && p === p.toUpperCase();
const isBlack = (p: string) => p && p === p.toLowerCase();

function inBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function legalMoves(board: Board, r: number, c: number): Pos[] {
  const piece = board[r][c];
  if (!piece) return [];
  const mine = isWhite(piece) ? isWhite : isBlack;
  const moves: Pos[] = [];
  const add = (nr: number, nc: number) => {
    if (!inBounds(nr, nc)) return false;
    const t = board[nr][nc];
    if (!t) { moves.push({ row: nr, col: nc }); return true; }
    if (!mine(t)) moves.push({ row: nr, col: nc });
    return false;
  };
  const ray = (dr: number, dc: number) => {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const t = board[nr][nc];
      if (!t) { moves.push({ row: nr, col: nc }); }
      else { if (!mine(t)) moves.push({ row: nr, col: nc }); break; }
      nr += dr; nc += dc;
    }
  };
  const p = piece.toLowerCase();
  if (p === "p") {
    const dir = isWhite(piece) ? -1 : 1;
    const startRow = isWhite(piece) ? 6 : 1;
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push({ row: r + dir, col: c });
      if (r === startRow && !board[r + 2 * dir][c]) moves.push({ row: r + 2 * dir, col: c });
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc] && !mine(board[nr][nc])) moves.push({ row: nr, col: nc });
    }
  } else if (p === "n") {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r + dr, c + dc);
  } else if (p === "b") {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) ray(dr, dc);
  } else if (p === "r") {
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) ray(dr, dc);
  } else if (p === "q") {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) ray(dr, dc);
  } else if (p === "k") {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(r + dr, c + dc);
  }
  return moves;
}

export default function ChessGame() {
  const [board, setBoard] = useState<Board>(initialBoard.map(r => [...r]));
  const [selected, setSelected] = useState<Pos | null>(null);
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [message, setMessage] = useState("White to move.");
  const [highlights, setHighlights] = useState<Pos[]>([]);

  const reset = () => {
    setBoard(initialBoard.map(r => [...r]));
    setSelected(null);
    setTurn("w");
    setMessage("White to move.");
    setHighlights([]);
  };

  const makeMove = (b: Board, from: Pos, to: Pos): Board => {
    const next = b.map(r => [...r]);
    let piece = next[from.row][from.col];
    if (piece.toLowerCase() === "p" && (to.row === 0 || to.row === 7)) {
      piece = isWhite(piece) ? "Q" : "q";
    }
    next[to.row][to.col] = piece;
    next[from.row][from.col] = "";
    return next;
  };

  useEffect(() => {
    if (turn !== "b") return;
    const timer = window.setTimeout(() => {
      const candidates: { from: Pos; to: Pos; score: number }[] = [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (isBlack(board[r][c])) {
          for (const m of legalMoves(board, r, c)) {
            const target = board[m.row][m.col];
            const score = target ? "PNBRQK".indexOf(target.toUpperCase()) + 2 : Math.random();
            candidates.push({ from: { row: r, col: c }, to: m, score });
          }
        }
      }
      if (!candidates.length) { setMessage("Black has no moves. You win!"); return; }
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      setBoard(makeMove(board, best.from, best.to));
      setTurn("w");
      setMessage("White to move.");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [turn, board]);

  const handleCellClick = (row: number, col: number) => {
    if (turn !== "w") return;
    const piece = board[row][col];

    if (selected) {
      if (selected.row === row && selected.col === col) {
        setSelected(null); setHighlights([]); return;
      }
      const legal = legalMoves(board, selected.row, selected.col);
      const target = legal.find(m => m.row === row && m.col === col);
      if (target) {
        setBoard(makeMove(board, selected, { row, col }));
        setSelected(null);
        setHighlights([]);
        setTurn("b");
        setMessage("Black thinking...");
        return;
      }
      if (piece && isWhite(piece)) {
        setSelected({ row, col });
        setHighlights(legalMoves(board, row, col));
        return;
      }
      setMessage("Illegal move.");
      return;
    }

    if (piece && isWhite(piece)) {
      setSelected({ row, col });
      setHighlights(legalMoves(board, row, col));
      setMessage(`Selected ${pieceLabels[piece]}.`);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-2xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Chess Master</h2>
        <p className="mt-2 text-slate-400">Single-player vs a simple AI. You play White.</p>
      </div>

      <div className="grid gap-1 rounded-[2rem] border border-slate-800 bg-slate-900 p-2 shadow-inner shadow-slate-950/30">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-8 gap-1">
            {row.map((cell, colIndex) => {
              const isSelected = selected?.row === rowIndex && selected?.col === colIndex;
              const isHighlight = highlights.some(h => h.row === rowIndex && h.col === colIndex);
              const isDark = (rowIndex + colIndex) % 2 === 1;
              return (
                <button
                  key={colIndex}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  className={`aspect-square rounded-2xl text-2xl font-semibold transition ${isDark ? "bg-slate-800" : "bg-slate-700"} ${isSelected ? "ring-2 ring-violet-400" : isHighlight ? "ring-2 ring-emerald-400" : "hover:ring-2 hover:ring-slate-500"}`}
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
          <p>Turn: {turn === "w" ? "White (You)" : "Black (AI)"}</p>
          <p className="text-slate-400 mt-1">{message}</p>
        </div>
        <button
          onClick={reset}
          className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          New Game
        </button>
      </div>
    </div>
  );
}