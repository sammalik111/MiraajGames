"use client";

// 8 Ball Pool — multiplayer (lite).
//
// Real online pool needs deterministic physics so both clients render
// identical ball trajectories from the same {angle, power} input. The
// existing PoolGame.tsx uses non-deterministic randomness in collisions,
// so reusing it as-is would desync the two clients within a few shots.
//
// This first multiplayer cut takes the honest, simple path: turn-based
// shot exchange with a coin-flip outcome per shot. Both players see the
// same shot history and remaining balls. Real physics ports come next.
//
// Move payloads:
//   { type: "shot", angleDeg: number, power: number }
//
// Outcome (sunk count) is derived deterministically from a hash of the
// move number + angle + power, so both clients reach identical states.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRematchVote } from "./useRematchVote";
import MultiplayerEndOverlay from "./MultiplayerEndOverlay";

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

type ShotPayload = { type: "shot"; angleDeg: number; power: number };
type GameStartPayload = { type: "game-start" };
type RematchVotePayload = { type: "rematch-vote" };
type ForfeitPayload = { type: "forfeit" };
type MovePayload =
  | ShotPayload
  | GameStartPayload
  | RematchVotePayload
  | ForfeitPayload;

interface MoveRow {
  moveNumber: number;
  senderId: string | null;
  payload: MovePayload;
}

const POLL_MS = 500;
const TARGET_SUNK = 8; // first to pocket 8 of their own balls wins

// Deterministic "did this shot sink anything?" — both clients compute the
// same answer from the same inputs, so no server adjudication needed.
function shotOutcome(moveNumber: number, angleDeg: number, power: number): number {
  // Cheap mixer: deterministic, no randomness.
  let h = (moveNumber * 2654435761) >>> 0;
  h = (h ^ ((angleDeg * 100) | 0)) >>> 0;
  h = ((h * 16777619) >>> 0) ^ ((power * 100) | 0);
  // Map to 0..3 sunk balls per shot, weighted toward 0–1.
  const r = h % 100;
  if (r < 60) return 0;
  if (r < 90) return 1;
  if (r < 98) return 2;
  return 3;
}

export default function PoolMultiplayer({
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

  // Shot input state.
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(50);

  // Count-based caching — server returns `unchanged: true` and skips the
  // moves SELECT when nothing's new since our last poll.
  const lastCountRef = useRef(-1);
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
    } catch {}
  }, [gameId, sessionId]);

  useEffect(() => {
    fetchMoves();
    const t = setInterval(fetchMoves, POLL_MS);
    return () => clearInterval(t);
  }, [fetchMoves]);

  const opponent = participants.find((p) => p.seat !== mySeat);
  const me = participants.find((p) => p.seat === mySeat);
  const opponentName = opponent?.name ?? "Opponent";
  const myUserId = me?.userId ?? null;
  const opponentUserId = opponent?.userId ?? null;

  // Filter to gameplay shots only (skip game-start, rematch-vote).
  const shots = useMemo(
    () =>
      moves.filter(
        (m): m is MoveRow & { payload: ShotPayload } => m.payload?.type === "shot",
      ),
    [moves],
  );

  // Tally sunk-balls per player by replaying shot outcomes.
  const tally = useMemo(() => {
    const sunk: Record<string, number> = {};
    for (const s of shots) {
      const sender = s.senderId ?? "?";
      const out = shotOutcome(s.moveNumber, s.payload.angleDeg, s.payload.power);
      sunk[sender] = (sunk[sender] ?? 0) + out;
    }
    return sunk;
  }, [shots]);

  const myTotal = (myUserId && tally[myUserId]) || 0;
  const opponentTotal = (opponentUserId && tally[opponentUserId]) || 0;
  const iWonRack = myTotal >= TARGET_SUNK;
  const iLostRack = opponentTotal >= TARGET_SUNK;

  // Forfeit detection — same trick as the other MP games. Whoever
  // posted the forfeit move loses; the other side wins immediately.
  const forfeit = useMemo(
    () =>
      moves.find(
        (m): m is MoveRow & { payload: ForfeitPayload } =>
          (m.payload as { type?: string })?.type === "forfeit",
      ) ?? null,
    [moves],
  );
  const opponentForfeited = !!forfeit && forfeit.senderId === opponentUserId;
  const iForfeited = !!forfeit && forfeit.senderId === myUserId;

  const iWon = iWonRack || opponentForfeited;
  const iLost = iLostRack || iForfeited;
  const gameOver = iWon || iLost;

  // Stats: report outcome once per game-end. Resets on rematch.
  const statsReportedRef = useRef(false);
  useEffect(() => {
    if (!gameOver) {
      statsReportedRef.current = false;
      return;
    }
    if (statsReportedRef.current) return;
    statsReportedRef.current = true;
    const finalOutcome = iForfeited ? "forfeit" : iWon ? "win" : "loss";
    fetch("/api/stats/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, outcome: finalOutcome }),
    }).catch(() => {
      statsReportedRef.current = false;
    });
  }, [gameOver, iForfeited, iWon, gameId]);

  const turnSeat = shots.length % 2;
  const myTurn = !gameOver && turnSeat === mySeat;

  // ---- Stage end overlay ---------------------------------------------
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    if (gameOver) {
      overlayTimerRef.current = setTimeout(() => setShowOverlay(true), 700);
    } else {
      setShowOverlay(false);
    }
    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, [gameOver]);

  // ---- Take a shot ---------------------------------------------------
  const takeShot = async () => {
    if (!myTurn) {
      setError("Not your turn.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: ShotPayload = { type: "shot", angleDeg: angle, power };
      const res = await fetch(`/api/games/${gameId}/multiplayer/moves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, payload }),
      });
      if (!res.ok) {
        const raw = await res.text();
        setError(`Shot failed: ${raw.slice(0, 200)}`);
        return;
      }
      await fetchMoves();
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Rematch (shared hook) -----------------------------------------
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

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      // Forfeit-then-leave: the opponent's polling sees the forfeit and
      // gets a "win by forfeit" overlay instead of a stuck table.
      if (!gameOver) {
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
      /* take the user to the lobby regardless */
    }
    router.push(`/games/${gameId}/lobby`);
  };

  const status = (() => {
    if (iWon) return "Rack closed. You win.";
    if (iLost) return `${opponentName} closed the rack.`;
    if (myTurn) return "Your shot.";
    return `${opponentName} is lining up...`;
  })();

  // Last shot summary so you can see what just happened.
  const lastShot = shots[shots.length - 1];
  const lastOut = lastShot
    ? shotOutcome(
        lastShot.moveNumber,
        lastShot.payload.angleDeg,
        lastShot.payload.power,
      )
    : null;

  return (
    <div className="relative flex flex-col items-center gap-4 max-w-md mx-auto">
      {/* HUD */}
      <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        <span>vs {opponentName}</span>
        <span>·</span>
        <span>
          You {myTotal}/{TARGET_SUNK}
        </span>
        <span>·</span>
        <span>
          Them {opponentTotal}/{TARGET_SUNK}
        </span>
        <span>·</span>
        <span className={myTurn ? "text-[color:var(--neon-lime)]" : ""}>
          {status}
        </span>
      </div>

      {/* Felt */}
      <div className="w-full aspect-[2/1] border-2 border-[color:var(--border-strong)] bg-[color:var(--neon-lime)]/15 relative flex items-center justify-center">
        {/* visual ball indicators based on totals */}
        <div className="absolute inset-3 flex flex-col gap-3 justify-between">
          <div className="flex gap-1">
            {Array.from({ length: TARGET_SUNK }).map((_, i) => (
              <div
                key={`me-${i}`}
                className="w-3 h-3 rounded-full border border-[color:var(--neon-cyan)]"
                style={{
                  background:
                    i < myTotal ? "var(--neon-cyan)" : "transparent",
                }}
              />
            ))}
          </div>
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            {lastShot
              ? `Last: ${lastShot.payload.angleDeg.toFixed(0)}° @ ${lastShot.payload.power}% → ${lastOut} sunk`
              : "First shot pending"}
          </p>
          <div className="flex gap-1 justify-end">
            {Array.from({ length: TARGET_SUNK }).map((_, i) => (
              <div
                key={`op-${i}`}
                className="w-3 h-3 rounded-full border border-[color:var(--neon-magenta)]"
                style={{
                  background:
                    i < opponentTotal ? "var(--neon-magenta)" : "transparent",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Shot inputs (disabled when not my turn) */}
      <div className="w-full grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
          Angle: {angle}°
          <input
            type="range"
            min={0}
            max={359}
            value={angle}
            onChange={(e) => setAngle(parseInt(e.target.value, 10))}
            disabled={!myTurn || submitting}
            className="accent-[color:var(--neon-cyan)]"
          />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
          Power: {power}%
          <input
            type="range"
            min={1}
            max={100}
            value={power}
            onChange={(e) => setPower(parseInt(e.target.value, 10))}
            disabled={!myTurn || submitting}
            className="accent-[color:var(--neon-cyan)]"
          />
        </label>
      </div>

      <button
        onClick={takeShot}
        disabled={!myTurn || submitting}
        className="font-mono text-xs uppercase tracking-[0.25em] px-6 py-3 text-black transition hover:brightness-110 disabled:opacity-40"
        style={{
          background: "var(--neon-cyan)",
          boxShadow: "0 0 20px -4px var(--neon-cyan)",
        }}
      >
        {submitting ? "..." : "Take Shot →"}
      </button>

      {error && (
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
          ✕ {error}
        </p>
      )}

      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] text-center">
        ⓘ Lite-mode multiplayer. Real physics with deterministic rendering<br />
        is the next iteration.
      </p>

      {showOverlay && (
        <MultiplayerEndOverlay
          outcome={iWon ? "win" : "loss"}
          opponentName={opponentName}
          headline={
            opponentForfeited
              ? "WIN BY FORFEIT"
              : iForfeited
                ? "FORFEITED"
                : iWon
                  ? "RACK CLOSED"
                  : "BETTER LUCK"
          }
          subtitle={
            opponentForfeited
              ? `${opponentName} walked away from the table. Rack is yours.`
              : iForfeited
                ? "You left the table — counted as a loss."
                : iWon
                  ? `Eight in the corner. ${opponentName} couldn't hang.`
                  : `${opponentName} sank theirs first.`
          }
          iVoted={rematch.iVoted}
          opponentVoted={rematch.opponentVoted}
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
