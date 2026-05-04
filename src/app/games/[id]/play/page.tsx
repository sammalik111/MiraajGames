"use client";

// Multiplayer play page. The lobby sends users here once the room fills
// up. URL: /games/[id]/play?session=<roomId>
//
// Responsibilities:
//   1. Verify the session exists and the current user is in it (via the
//      gameRoom GET endpoint), and pull our seat number from it.
//   2. Mount the right multiplayer component for the gameId.
//
// We deliberately don't go through GameShell here — the multiplayer flow
// has its own end-of-game handling that's per-game (declare winner via
// move replay, no single-player score to submit).

import Navbar from "@/components/navbar";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { games } from "@/data/gameData";
import TicTacToeMultiplayer from "@/components/games/multiplayer/TicTacToeMultiplayer";
import BattleshipMultiplayer from "@/components/games/multiplayer/BattleshipMultiplayer";
import PoolMultiplayer from "@/components/games/multiplayer/PoolMultiplayer";

interface RoomSnapshot {
  room: { id: string; gameId: number; isFull: boolean; maxPlayers: number };
  participants: Array<{ userId: string; name: string | null; seat: number }>;
}

export default function PlayPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { userId, authed, loading: authLoading } = useAuth();

  const gameId = parseInt(params.id, 10);
  const sessionId = search.get("session");
  const game = games.find((g) => g.id === gameId);

  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pull the current room state once on mount so we know our seat number
  // and can verify the user is actually in this session.
  useEffect(() => {
    if (!authed || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/games/${encodeURIComponent(params.id)}/multiplayer/gameRoom`,
          { method: "GET" },
        );
        if (cancelled) return;
        if (res.status === 204) {
          setError("You're not in any room for this game.");
          return;
        }
        if (!res.ok) {
          setError(`Could not load room (${res.status}).`);
          return;
        }
        const data = (await res.json()) as RoomSnapshot;
        if (data.room.id !== sessionId) {
          setError("Session mismatch — you're in a different room.");
          return;
        }
        setSnapshot(data);
      } catch (e) {
        setError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, sessionId, params.id]);

  if (!game) return notFound("Cabinet not found.");
  if (!sessionId) return notFound("Missing session.");
  if (authLoading) return loading("Authenticating...");
  if (!authed) return notFound("Sign in to play.");
  if (error) return notFound(error);
  if (!snapshot) return loading("Joining session...");

  // Find my seat in the room snapshot.
  const me = snapshot.participants.find((p) => p.userId === userId);
  if (!me) return notFound("You're not in this room.");

  // ---- Pick the multiplayer component for this game id -----------------
  const renderGame = () => {
    switch (gameId) {
      case 16: // TicTacToe MP
        return (
          <TicTacToeMultiplayer
            gameId={gameId}
            sessionId={sessionId}
            mySeat={me.seat}
            participants={snapshot.participants}
          />
        );
      case 17: // Battleship MP
        return (
          <BattleshipMultiplayer
            gameId={gameId}
            sessionId={sessionId}
            mySeat={me.seat}
            participants={snapshot.participants}
          />
        );
      case 18: // 8 Ball Pool MP (lite)
        return (
          <PoolMultiplayer
            gameId={gameId}
            sessionId={sessionId}
            mySeat={me.seat}
            participants={snapshot.participants}
          />
        );
      default:
        return notFound(`No multiplayer client wired up for game #${gameId} yet.`);
    }
  };

  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <Link
          href={`/games/${gameId}/lobby`}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-cyan)] transition"
        >
          ← Back to Lobby
        </Link>

        <div className="mt-6 flex items-center justify-between">
          <h1 className="font-display font-black text-3xl tracking-tight">
            {game.title}
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            seat {me.seat + 1} / {snapshot.room.maxPlayers}
          </span>
        </div>

        <div className="mt-6 border border-[color:var(--border-strong)] bg-[color:var(--surface-1)] p-6">
          {renderGame()}
        </div>
      </main>
    </div>
  );
}

// ---- Tiny shared helpers ---------------------------------------------
function notFound(msg: string) {
  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
          ✕ {msg}
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex font-mono text-xs uppercase tracking-[0.2em] px-5 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
        >
          ← Back to Arcade
        </Link>
      </main>
    </div>
  );
}

function loading(msg: string) {
  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
          <span className="blink">●</span> {msg}
        </p>
      </main>
    </div>
  );
}
