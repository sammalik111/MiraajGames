"use client";

// TicTacToe — multiplayer client.
//
// Architecture:
//   - The full board state lives ONLY on the client. The server stores
//     moves (one cell-index per row) as opaque jsonb.
//   - On mount + every POLL_MS, we GET moves since our last-seen number
//     and replay them into local state.
//   - A click validates locally (own turn? cell empty?), POSTs the move.
//   - Win / draw detection runs locally after each replay.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TicTacToeMove } from "@/db/schema";

type Cell = "X" | "O" | null;
type Board = Cell[]; // length 9

interface Props {
  gameId: number;
  sessionId: string;
  mySeat: number; // 0 = X, 1 = O (round-robin by move_number % maxPlayers)
}

interface MoveRow {
  moveNumber: number;
  senderId: string | null;
  payload: TicTacToeMove;
  createdAt: string;
}

const POLL_MS = 1500;

const WIN_LINES: Array<[number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

// Replay a flat move list into a 9-cell board. Move 0 = X, 1 = O, 2 = X...
function replay(moves: MoveRow[]): Board {
  const board: Board = Array(9).fill(null);
  for (const m of moves) {
    const mark = m.moveNumber % 2 === 0 ? "X" : "O";
    if (typeof m.payload?.cell === "number") board[m.payload.cell] = mark;
  }
  return board;
}

function detectWinner(board: Board): { winner: Cell; line: [number, number, number] | null } {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

export default function TicTacToeMultiplayer({ gameId, sessionId, mySeat }: Props) {
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Last move number we've processed, used as the cursor for incremental polling.
  const lastSeenRef = useRef<number>(-1);

  // ---- Polling ---------------------------------------------------------
  const fetchMoves = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/games/${gameId}/multiplayer/moves?sessionId=${encodeURIComponent(sessionId)}&since=${lastSeenRef.current}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { moves: MoveRow[] };
      if (data.moves.length === 0) return;
      setMoves((prev) => [...prev, ...data.moves]);
      lastSeenRef.current = data.moves[data.moves.length - 1].moveNumber;
    } catch {
      /* network blip — try again next tick */
    }
  }, [gameId, sessionId]);

  useEffect(() => {
    fetchMoves();
    const t = setInterval(fetchMoves, POLL_MS);
    return () => clearInterval(t);
  }, [fetchMoves]);

  // ---- Derived state ---------------------------------------------------
  const board = useMemo(() => replay(moves), [moves]);
  const { winner, line: winningLine } = useMemo(() => detectWinner(board), [board]);
  const isDraw = !winner && moves.length === 9;
  const gameOver = !!winner || isDraw;

  // 0 = X plays moves 0,2,4,...; 1 = O plays moves 1,3,5,...
  const turnSeat = moves.length % 2;
  const myMark: "X" | "O" = mySeat === 0 ? "X" : "O";
  const myTurn = !gameOver && turnSeat === mySeat;

  // ---- Submit a move ---------------------------------------------------
  const playCell = async (cell: number) => {
    if (gameOver) return;
    if (!myTurn) {
      setError("Not your turn yet.");
      return;
    }
    if (board[cell] !== null) {
      setError("That cell is taken.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/multiplayer/moves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          moveNumber: moves.length,
          payload: { cell } satisfies TicTacToeMove,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        let msg = raw;
        try {
          msg = JSON.parse(raw)?.error ?? raw;
        } catch {}
        setError(`Move rejected: ${msg.slice(0, 200)}`);
        // Re-sync to whatever the server thinks. Likely we raced another player.
        await fetchMoves();
        return;
      }
      // Optimistically pull our own move in.
      await fetchMoves();
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render ----------------------------------------------------------
  const status = (() => {
    if (winner) return winner === myMark ? "You win." : "You lose.";
    if (isDraw) return "Draw.";
    if (myTurn) return "Your turn.";
    return "Waiting for opponent...";
  })();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* HUD */}
      <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        <span>
          You are{" "}
          <span
            className={
              myMark === "X"
                ? "text-[color:var(--neon-cyan)]"
                : "text-[color:var(--neon-magenta)]"
            }
          >
            {myMark}
          </span>
        </span>
        <span>·</span>
        <span>Move #{moves.length + (gameOver ? 0 : 1)}</span>
        <span>·</span>
        <span
          className={
            myTurn
              ? "text-[color:var(--neon-lime)]"
              : "text-[color:var(--fg-muted)]"
          }
        >
          {status}
        </span>
      </div>

      {/* BOARD */}
      <div className="grid grid-cols-3 gap-2 p-2 border border-[color:var(--border-strong)] bg-[color:var(--surface-2)]">
        {board.map((cell, i) => {
          const isWinningCell = winningLine?.includes(i);
          const interactable = !gameOver && myTurn && cell === null && !submitting;
          return (
            <button
              key={i}
              onClick={() => playCell(i)}
              disabled={!interactable}
              className={`w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center font-display font-black text-4xl sm:text-5xl border transition ${
                isWinningCell
                  ? "border-[color:var(--neon-lime)] bg-[color:var(--neon-lime)]/10"
                  : "border-[color:var(--border)]"
              } ${
                interactable
                  ? "hover:border-[color:var(--neon-cyan)] hover:bg-[color:var(--neon-cyan)]/10 cursor-pointer"
                  : "cursor-not-allowed"
              }`}
            >
              <span
                className={
                  cell === "X"
                    ? "text-[color:var(--neon-cyan)]"
                    : cell === "O"
                      ? "text-[color:var(--neon-magenta)]"
                      : ""
                }
              >
                {cell}
              </span>
            </button>
          );
        })}
      </div>

      {/* ERROR */}
      {error && (
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
          ✕ {error}
        </p>
      )}
    </div>
  );
}
