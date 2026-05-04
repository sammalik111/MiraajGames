"use client";

// Shared rematch state machine for every multiplayer game.
//
// Treats the move log as a vote tally — any row whose payload looks like
// `{ type: "rematch-vote" }` counts. When BOTH the local user and the
// opponent have a vote, the host (lower-seat player) fires the DELETE
// that wipes all moves, which both clients pick up on their next poll
// and reset their local state from.
//
// Why a hook (not just a component): the rematch logic touches polling,
// fetch, vote-detection, and host-only triggering — all of which need
// to stay coordinated. Putting it in a shared hook means TTT, Battleship,
// and Pool all get the exact same flow with no chance of one drifting.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface MoveRowLike {
  senderId: string | null;
  payload: unknown;
}

interface Args {
  gameId: number;
  sessionId: string;
  mySeat: number;
  myUserId: string | null;
  opponentUserId: string | null;
  moves: MoveRowLike[];
  // Re-fetch from the server (called after we cast / cancel a vote).
  fetchMoves: () => Promise<void>;
  // Called when both votes have landed — game owns the reset (clear
  // local state, regenerate ships, etc.). The hook still handles the
  // server-side wipe.
  onReset: () => void;
}

interface Result {
  // Vote tally
  iVoted: boolean;
  opponentVoted: boolean;
  opponentPresent: boolean;
  // Actions (fire-and-await; surface returned errors via the `error` field)
  requestRematch: () => Promise<void>;
  cancelVote: () => Promise<void>;
  voting: boolean;
  voteError: string | null;
  clearVoteError: () => void;
}

function isRematchVote(p: unknown): p is { type: "rematch-vote" } {
  return (
    typeof p === "object" &&
    p !== null &&
    "type" in p &&
    (p as { type: unknown }).type === "rematch-vote"
  );
}

export function useRematchVote({
  gameId,
  sessionId,
  mySeat,
  myUserId,
  opponentUserId,
  moves,
  fetchMoves,
  onReset,
}: Args): Result {
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [opponentPresent, setOpponentPresent] = useState(true);

  const voteSenderIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of moves) {
      if (isRematchVote(m.payload) && m.senderId) set.add(m.senderId);
    }
    return set;
  }, [moves]);

  const iVoted = !!myUserId && voteSenderIds.has(myUserId);
  const opponentVoted = !!opponentUserId && voteSenderIds.has(opponentUserId);

  // Once both votes are in, host (seat 0) fires the wipe. Other client
  // catches up on the next poll. Idempotent — even if both fire the
  // DELETE, second is a no-op.
  const wipingRef = useRef(false);
  useEffect(() => {
    if (!iVoted || !opponentVoted) return;
    if (mySeat !== 0) return;
    if (wipingRef.current) return;
    wipingRef.current = true;
    (async () => {
      try {
        await fetch(
          `/api/games/${gameId}/multiplayer/moves?sessionId=${encodeURIComponent(sessionId)}`,
          { method: "DELETE" },
        );
        // Tell the parent component to reset its local game state. The
        // server-side moves are already gone, so the next poll will see
        // an empty list and the parent will be in sync.
        onReset();
      } catch {
        // If we couldn't wipe, the OTHER client (also detecting both
        // votes) will keep trying via its own polling tick. Eventually
        // one DELETE goes through.
      } finally {
        wipingRef.current = false;
      }
    })();
  }, [iVoted, opponentVoted, mySeat, gameId, sessionId, onReset]);

  // Non-host: when both votes are present, the host's DELETE will arrive
  // shortly. When `moves` next becomes empty (or just shorter), the
  // parent's effect that watches the move list should call onReset too.
  // We give it a nudge here so it's not missed.
  const lastResetRef = useRef(false);
  useEffect(() => {
    const wasReset = iVoted && opponentVoted;
    if (wasReset && !lastResetRef.current && mySeat !== 0) {
      // Host is firing DELETE now — wait one tick for it to land,
      // then refetch. The empty result triggers parent's reset path.
      lastResetRef.current = true;
      const t = setTimeout(() => {
        fetchMoves().then(() => {
          lastResetRef.current = false;
        });
      }, 600);
      return () => clearTimeout(t);
    }
    if (!wasReset) lastResetRef.current = false;
  }, [iVoted, opponentVoted, mySeat, fetchMoves]);

  const requestRematch = useCallback(async () => {
    if (voting || iVoted) return;
    setVoteError(null);
    setVoting(true);
    try {
      // Confirm opponent is still in the room before voting.
      const roomRes = await fetch(
        `/api/games/${gameId}/multiplayer/gameRoom`,
        { method: "GET" },
      );
      if (roomRes.status === 204) {
        setOpponentPresent(false);
        setVoteError("You're not in this room anymore.");
        return;
      }
      if (roomRes.ok) {
        const data = (await roomRes.json()) as {
          room: { isFull: boolean; maxPlayers: number };
          participants: { userId: string }[];
        };
        if (
          !data.room.isFull ||
          data.participants.length < data.room.maxPlayers
        ) {
          setOpponentPresent(false);
          setVoteError("Opponent left — rematch unavailable.");
          return;
        }
        setOpponentPresent(true);
      }

      const voteRes = await fetch(`/api/games/${gameId}/multiplayer/moves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          payload: { type: "rematch-vote" },
        }),
      });
      if (!voteRes.ok) {
        const raw = await voteRes.text();
        let msg = raw;
        try {
          msg = JSON.parse(raw)?.error ?? raw;
        } catch {}
        setVoteError(`Vote rejected: ${msg.slice(0, 200)}`);
        return;
      }
      await fetchMoves();
    } catch (e) {
      setVoteError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setVoting(false);
    }
  }, [voting, iVoted, gameId, sessionId, fetchMoves]);

  const cancelVote = useCallback(async () => {
    if (!iVoted) return;
    setVoteError(null);
    try {
      const res = await fetch(
        `/api/games/${gameId}/multiplayer/moves?sessionId=${encodeURIComponent(sessionId)}&onlyMyVote=true`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const raw = await res.text();
        setVoteError(`Cancel failed (${res.status}): ${raw.slice(0, 200)}`);
        return;
      }
      await fetchMoves();
    } catch (e) {
      setVoteError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [iVoted, gameId, sessionId, fetchMoves]);

  return {
    iVoted,
    opponentVoted,
    opponentPresent,
    requestRematch,
    cancelVote,
    voting,
    voteError,
    clearVoteError: () => setVoteError(null),
  };
}
