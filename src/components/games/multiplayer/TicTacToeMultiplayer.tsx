"use client";

// TicTacToe — multiplayer client.
//
// State model:
//   - The full board lives ONLY on the client. Server stores moves
//     (one cell-index per row) as opaque jsonb.
//   - Polling uses the server's count-based caching: we send `?lastCount=N`
//     and the server returns `{count, unchanged: true}` when nothing
//     changed, skipping the moves SELECT entirely.
//   - Click validates locally (own turn? cell empty?), POSTs the move
//     with no `moveNumber` — server picks the next slot.
//   - Win / draw detection runs locally after each replay.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TicTacToeMove } from "@/db/schema";
import { useRematchVote } from "./useRematchVote";
import MultiplayerEndOverlay from "./MultiplayerEndOverlay";

type Cell = "X" | "O" | null;
type Board = Cell[];

interface Participant {
  userId: string;
  name: string | null;
  seat: number;
}

interface Props {
  gameId: number;
  sessionId: string;
  mySeat: number;
  participants: Participant[];
}

type MovePayload =
  | TicTacToeMove
  | { type: "rematch-vote" }
  | { type: "game-start" }
  | { type: "forfeit" };

interface MoveRow {
  moveNumber: number;
  senderId: string | null;
  payload: MovePayload;
  createdAt: string;
}

// Helper used by both the leaver (so it skips posting redundant forfeits
// after a real outcome) and the watcher (so it can detect the opponent
// bailing).
function isForfeit(p: MovePayload): p is { type: "forfeit" } {
  return typeof p === "object" && "type" in p && p.type === "forfeit";
}

const POLL_MS = 500;
const OVERLAY_DELAY_MS = 700;

const WIN_LINES: Array<[number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function isGameplay(p: MovePayload): p is TicTacToeMove {
  return (
    typeof p === "object" &&
    !("type" in p) &&
    typeof (p as { cell?: unknown }).cell === "number"
  );
}

function replay(moves: MoveRow[]): Board {
  const board: Board = Array(9).fill(null);
  let cellMoveIndex = 0;
  for (const m of moves) {
    if (!isGameplay(m.payload)) continue;
    const mark = cellMoveIndex % 2 === 0 ? "X" : "O";
    board[m.payload.cell] = mark;
    cellMoveIndex += 1;
  }
  return board;
}

function detectWinner(board: Board): {
  winner: Cell;
  line: [number, number, number] | null;
} {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

export default function TicTacToeMultiplayer({
  gameId,
  sessionId,
  mySeat,
  participants,
}: Props) {
  const router = useRouter();
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Cache cursor — last move count we know about. Server returns
  // unchanged: true when this matches its current count.
  const lastCountRef = useRef(-1);

  // ---- Polling ---------------------------------------------------------
  const fetchMoves = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/games/${gameId}/multiplayer/moves?sessionId=${encodeURIComponent(sessionId)}&lastCount=${lastCountRef.current}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as
        | { count: number; unchanged: true }
        | { count: number; moves: MoveRow[] };
      lastCountRef.current = data.count;
      if ("moves" in data) setMoves(data.moves);
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
  const cellMoves = useMemo(
    () => moves.filter((m) => isGameplay(m.payload)),
    [moves],
  );
  const board = useMemo(() => replay(moves), [moves]);
  const { winner, line: winningLine } = useMemo(
    () => detectWinner(board),
    [board],
  );
  const isDraw = !winner && cellMoves.length === 9;

  // Forfeit detection — first row in the move log whose payload is a
  // forfeit signal. Whichever player posted it has bailed.
  const forfeit = useMemo(
    () => moves.find((m) => isForfeit(m.payload)) ?? null,
    [moves],
  );

  const opponent = participants.find((p) => p.seat !== mySeat);
  const me = participants.find((p) => p.seat === mySeat);
  const opponentName = opponent?.name ?? "Opponent";
  const myUserId = me?.userId ?? null;
  const opponentUserId = opponent?.userId ?? null;

  const opponentForfeited = !!forfeit && forfeit.senderId === opponentUserId;
  const iForfeited = !!forfeit && forfeit.senderId === myUserId;
  const gameOver = !!winner || isDraw || !!forfeit;

  const turnSeat = cellMoves.length % 2;
  const myMark: "X" | "O" = mySeat === 0 ? "X" : "O";
  const myTurn = !gameOver && turnSeat === mySeat;

  // ---- Overlay reveal --------------------------------------------------
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    if (gameOver) {
      overlayTimerRef.current = setTimeout(
        () => setShowOverlay(true),
        OVERLAY_DELAY_MS,
      );
    } else {
      setShowOverlay(false);
    }
    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, [gameOver]);

  // ---- Rematch hook ----------------------------------------------------
  const handleResetLocal = useCallback(() => {
    setMoves([]);
    lastCountRef.current = -1;
    setShowOverlay(false);
  }, []);

  const rematch = useRematchVote({
    gameId,
    sessionId,
    mySeat,
    myUserId,
    opponentUserId,
    moves,
    fetchMoves,
    onReset: handleResetLocal,
  });

  // ---- Click cell ------------------------------------------------------
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
          payload: { cell } satisfies TicTacToeMove,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        let msg = raw;
        try { msg = JSON.parse(raw)?.error ?? raw; } catch {}
        setError(`Move rejected: ${msg.slice(0, 200)}`);
        await fetchMoves();
        return;
      }
      await fetchMoves();
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Leave room ------------------------------------------------------
  // If the game isn't already decided, we post a forfeit move FIRST so
  // the opponent's polling picks it up and renders a "win by forfeit"
  // overlay instead of staring at a frozen board wondering where we
  // went. Then we drop our participant row and navigate.
  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      if (!gameOver) {
        // Server is participant-checked + game-must-be-running; this
        // post needs to happen BEFORE the gameRoom DELETE which flips
        // isFull back to false.
        await fetch(`/api/games/${gameId}/multiplayer/moves`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            payload: { type: "forfeit" },
          }),
        });
      }
      await fetch(`/api/games/${gameId}/multiplayer/gameRoom`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: sessionId }),
      });
    } catch {
      /* even if either request fails, take the user to the lobby */
    }
    router.push(`/games/${gameId}/lobby`);
  };

  const status = (() => {
    if (opponentForfeited) return `${opponentName} bailed.`;
    if (iForfeited) return "You forfeited.";
    if (winner) return winner === myMark ? "You win." : "You lose.";
    if (isDraw) return "Draw.";
    if (myTurn) return "Your turn.";
    return `${opponentName}'s turn...`;
  })();

  const outcome: "win" | "loss" | "draw" = winner
    ? winner === myMark
      ? "win"
      : "loss"
    : opponentForfeited
      ? "win"
      : iForfeited
        ? "loss"
        : "draw";

  return (
    <div className="relative flex flex-col items-center gap-4">
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
        <span>vs {opponentName}</span>
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

      {error && (
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
          ✕ {error}
        </p>
      )}

      {showOverlay && (
        <MultiplayerEndOverlay
          outcome={outcome}
          opponentName={opponentName}
          headline={
            opponentForfeited
              ? "WIN BY FORFEIT"
              : iForfeited
                ? "FORFEITED"
                : undefined
          }
          subtitle={
            opponentForfeited
              ? `${opponentName} bailed out. The match is yours.`
              : iForfeited
                ? "You left the match — counted as a loss."
                : undefined
          }
          iVoted={rematch.iVoted}
          opponentVoted={rematch.opponentVoted}
          // After a forfeit, rematch isn't possible — opponent is gone.
          opponentPresent={rematch.opponentPresent && !forfeit}
          voting={rematch.voting || leaving}
          errorMessage={rematch.voteError}
          onRematch={rematch.requestRematch}
          onCancelVote={rematch.cancelVote}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
