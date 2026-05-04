"use client";

import Navbar from "@/components/navbar";
import { games } from "@/data/gameData";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

// Mirrors the JSON shape returned by POST/PUT/DELETE on the gameRoom route.
interface RoomSnapshot {
  room: {
    id: string;
    gameId: number;
    public: boolean;
    isFull: boolean;
    maxPlayers: number;
    createdBy: string | null;
    createdAt: string;
  };
  participants: Array<{
    userId: string;
    name: string | null;
    seat: number;
    joinedAt: string;
  }>;
}

export default function GameLobbyPage() {
  const params = useParams<{ id: string }>();
  const gameID = params.id;
  const game = games.find((g) => g.id === parseInt(gameID, 10));
  const { userId, authed, loading: authLoading } = useAuth();
  const router = useRouter();

  // Two pieces of UI state:
  //   snapshot — when set, render the in-room view; when null, render the
  //              create/join actions.
  //   error    — surface the latest fetch failure inline so the user knows
  //              what went wrong without opening DevTools.
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state for the idle view.
  const [joinIdInput, setJoinIdInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // ---- Synced start polling --------------------------------------------
  // Once we're in a room, poll the moves endpoint for a `{type:"game-start"}`
  // signal. Whoever clicks Start posts that signal; both clients see it
  // and navigate together. No DB changes — the moves table doubles as a
  // signal channel.
  useEffect(() => {
    if (!snapshot) return;
    const sessionId = snapshot.room.id;
    let cancelled = false;
    let lastCount = -1;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/games/${encodeURIComponent(gameID)}/multiplayer/moves?sessionId=${encodeURIComponent(sessionId)}&lastCount=${lastCount}`,
          { cache: "no-store" },
        );
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as
          | { count: number; unchanged: true }
          | { count: number; moves: Array<{ payload: Record<string, unknown> }> };
        lastCount = data.count;
        if ("moves" in data) {
          const started = data.moves.some((m) => m.payload?.type === "game-start");
          if (started) {
            cancelled = true;
            router.push(
              `/games/${encodeURIComponent(gameID)}/play?session=${encodeURIComponent(sessionId)}`,
            );
          }
        }
      } catch {
        /* swallow — try again next tick */
      }
    };
    tick();
    const t = setInterval(tick, 800);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [snapshot, gameID, router]);

  // ---- Auto-repopulate on mount ----------------------------------------
  // If the user is already a participant in a room for this game (e.g. they
  // refreshed the page or logged back in), GET returns the snapshot and we
  // drop them straight into the in-room view without going through join.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/games/${encodeURIComponent(gameID)}/multiplayer/gameRoom`,
          { method: "GET" },
        );
        if (cancelled) return;
        if (res.status === 204) return; // user not in any room — stay idle
        if (!res.ok) return; // silent — auto-repop is a nice-to-have
        const data = (await res.json()) as RoomSnapshot;
        setSnapshot(data);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, gameID]);

  // ---- Shared fetch wrapper ---------------------------------------------
  // Centralizes error parsing so each handler doesn't repeat it.
  const callRoomApi = useCallback(
    async (
      method: "POST" | "PUT" | "DELETE",
      body: Record<string, unknown>,
    ): Promise<RoomSnapshot | null> => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(
          `/api/games/${encodeURIComponent(gameID)}/multiplayer/gameRoom`,
          {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          // Server responses are JSON, but if Next returns its HTML 404
          // we want the text fallback to show *something* useful.
          const raw = await res.text();
          let msg = raw;
          try {
            const parsed = JSON.parse(raw);
            msg = parsed?.error ?? raw;
          } catch {
            /* HTML response — use raw */
          }
          setError(`${method} failed (${res.status}): ${msg.slice(0, 200)}`);
          return null;
        }
        return (await res.json()) as RoomSnapshot;
      } catch (err) {
        setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [gameID],
  );

  // ---- Handlers ---------------------------------------------------------
  const handleCreate = async () => {
    const data = await callRoomApi("POST", { isChecked: isPublic });
    if (data) setSnapshot(data);
  };

  const handleJoinRandom = async () => {
    const data = await callRoomApi("PUT", { roomID: null });
    if (data) setSnapshot(data);
  };

  const handleJoinById = async () => {
    const trimmed = joinIdInput.trim();
    if (!trimmed) {
      setError("Enter a room ID first.");
      return;
    }
    const data = await callRoomApi("PUT", { roomID: trimmed });
    if (data) setSnapshot(data);
  };

  const handleLeave = async () => {
    if (!snapshot) return;
    const res = await fetch(
      `/api/games/${encodeURIComponent(gameID)}/multiplayer/gameRoom`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: snapshot.room.id }),
      },
    );
    if (!res.ok) {
      const raw = await res.text();
      setError(`Leave failed (${res.status}): ${raw.slice(0, 200)}`);
      return;
    }
    // Whether the room was deleted or just emptied, drop back to the idle view.
    setSnapshot(null);
    setJoinIdInput("");
  };

  const handleStartGame = async () => {
    if (!snapshot) return;
    if (!snapshot.room.isFull) {
      setError("Waiting for more players before starting.");
      return;
    }
    // Post a game-start signal so the OTHER client's poll picks it up
    // and auto-navigates too. Then navigate ourselves.
    try {
      await fetch(
        `/api/games/${encodeURIComponent(gameID)}/multiplayer/moves`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: snapshot.room.id,
            payload: { type: "game-start" },
          }),
        },
      );
    } catch {
      /* even if the signal POST fails, take ourselves into the game.
         The other client can re-click Start themselves. */
    }
    router.push(
      `/games/${encodeURIComponent(gameID)}/play?session=${encodeURIComponent(snapshot.room.id)}`,
    );
  };

  // ---- 404 for unknown game --------------------------------------------
  if (!game) {
    return (
      <div className="min-h-screen text-[color:var(--fg)]">
        <Navbar />
        <main className="relative z-10 mx-auto max-w-3xl px-4 py-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
            ✕ Signal lost
          </p>
          <h1 className="mt-3 font-display font-black text-4xl sm:text-5xl tracking-tight">
            CABINET{" "}
            <span className="text-[color:var(--neon-magenta)] dark:glow-magenta">
              404
            </span>
          </h1>
          <p className="mt-4 text-[color:var(--fg-muted)]">
            This cabinet is offline or was never installed.
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

  // ---- Render -----------------------------------------------------------
  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />

      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-4">
        <div
          className="w-full max-w-md border bg-[color:var(--surface-1)] shadow-[0_0_60px_-10px_rgba(0,255,255,0.4)]"
          style={{
            borderColor: "var(--neon-cyan)",
            clipPath:
              "polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))",
          }}
        >
          {/* HEADER */}
          <div
            className="px-5 py-2 flex items-center justify-between"
            style={{
              background: "linear-gradient(90deg, var(--neon-cyan)22, transparent)",
              borderBottom: "1px solid var(--neon-cyan)44",
            }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--neon-cyan)]">
              ▸ {snapshot ? "IN ROOM" : "GAME LOBBY"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
              #{String(game.id).padStart(2, "0")}
            </span>
          </div>

          {/* ERROR BANNER (always reserved at top so layout doesn't jump) */}
          {error && (
            <div
              className="px-4 py-2 border-b border-[color:var(--neon-magenta)]/60 bg-[color:var(--neon-magenta)]/10 flex items-start justify-between gap-3"
            >
              <span className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.18em] text-[color:var(--neon-magenta)] break-words flex-1">
                ✕ {error}
              </span>
              <button
                onClick={() => setError(null)}
                className="font-mono text-[10px] text-[color:var(--neon-magenta)] hover:brightness-125"
                aria-label="dismiss"
              >
                [×]
              </button>
            </div>
          )}

          {/* BODY */}
          <div className="px-5 py-5 space-y-6">
            {/* GAME META — always shown */}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] mb-3">
                ── Cabinet Info ──
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: "Title", v: game.title },
                  { k: "Theme", v: game.theme },
                  { k: "Author", v: game.creator },
                  { k: "Mode", v: "Multiplayer" },
                ].map((item) => (
                  <div
                    key={item.k}
                    className="border-l-2 border-[color:var(--neon-cyan)] pl-3"
                  >
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
                      {item.k}
                    </p>
                    <p className="text-sm truncate">{item.v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SWITCHED VIEW: idle (no room) vs in-room */}
            {!snapshot ? (
              // ---- IDLE VIEW: create / join actions --------------------
              <>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] mb-2">
                    ── Actions ──
                  </p>

                  <div className="border-t border-[color:var(--border)] divide-y divide-[color:var(--border)]">
                    {/* PUBLIC TOGGLE */}
                    <label className="w-full flex items-center justify-between px-2 py-3 font-mono text-xs cursor-pointer hover:bg-[color:var(--neon-cyan)]/5 transition">
                      <span>Make room public (matchmaking can find it)</span>
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="accent-[color:var(--neon-cyan)] w-4 h-4"
                      />
                    </label>

                    {/* CREATE */}
                    <button
                      onClick={handleCreate}
                      disabled={busy}
                      className="w-full flex justify-between px-2 py-3 font-mono text-xs hover:bg-[color:var(--neon-cyan)]/10 transition disabled:opacity-40"
                    >
                      <span>
                        Create Game{" "}
                        {isPublic && (
                          <span className="text-[color:var(--neon-cyan)]">(public)</span>
                        )}
                      </span>
                      <span className="text-[color:var(--fg-muted)]">→</span>
                    </button>

                    {/* RANDOM */}
                    <button
                      onClick={handleJoinRandom}
                      disabled={busy}
                      className="w-full flex justify-between px-2 py-3 font-mono text-xs hover:bg-[color:var(--neon-cyan)]/10 transition disabled:opacity-40"
                    >
                      <span>Join Random Public Room</span>
                      <span className="text-[color:var(--fg-muted)]">→</span>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] mb-2">
                    ── Join by ID ──
                  </p>
                  <input
                    type="text"
                    value={joinIdInput}
                    onChange={(e) => setJoinIdInput(e.target.value)}
                    placeholder="ENTER ROOM ID"
                    disabled={busy}
                    className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] px-4 py-3 text-sm font-mono tracking-widest text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition disabled:opacity-40"
                  />
                  <button
                    onClick={handleJoinById}
                    disabled={busy || !joinIdInput.trim()}
                    className="mt-3 w-full font-mono text-xs uppercase tracking-[0.3em] py-3 text-black transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: "var(--neon-cyan)",
                      boxShadow: "0 0 20px -4px var(--neon-cyan)",
                    }}
                  >
                    Join Room
                  </button>
                </div>

                {authLoading && (
                  <p className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                    <span className="blink">●</span> Checking session...
                  </p>
                )}
              </>
            ) : (
              // ---- IN-ROOM VIEW: room ID, participants, leave/start ----
              <InRoomView
                snapshot={snapshot}
                currentUserId={userId}
                busy={busy}
                onLeave={handleLeave}
                onStart={handleStartGame}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// In-room view — extracted into its own component so the parent stays focused
// on state management and the routing/error glue.
// ---------------------------------------------------------------------------
function InRoomView({
  snapshot,
  currentUserId,
  busy,
  onLeave,
  onStart,
}: {
  snapshot: RoomSnapshot;
  currentUserId: string | null;
  busy: boolean;
  onLeave: () => void;
  onStart: () => void;
}) {
  const { room, participants } = snapshot;
  const seatsFilled = participants.length;
  const canStart = room.isFull;

  const copyRoomId = () => {
    navigator.clipboard?.writeText(room.id).catch(() => {});
  };

  return (
    <>
      {/* ROOM ID — copyable, since it's how friends join */}
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] mb-2">
          ── Room ID ──
        </p>
        <button
          onClick={copyRoomId}
          className="w-full text-left bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] px-4 py-3 font-mono text-sm tracking-widest text-[color:var(--neon-cyan)] hover:border-[color:var(--neon-cyan)] transition flex items-center justify-between gap-2"
          title="Click to copy"
        >
          <span className="truncate">{room.id}</span>
          <span className="text-[9px] uppercase tracking-[0.25em] text-[color:var(--fg-muted)] flex-shrink-0">
            copy
          </span>
        </button>
      </div>

      {/* ROOM STATUS — public/private + seats filled */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border-l-2 border-[color:var(--neon-cyan)] pl-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
            Visibility
          </p>
          <p className="text-sm">{room.public ? "Public" : "Private"}</p>
        </div>
        <div className="border-l-2 border-[color:var(--neon-cyan)] pl-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
            Seats
          </p>
          <p className="text-sm">
            {seatsFilled} / {room.maxPlayers}
            {room.isFull && (
              <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--neon-lime)]">
                full
              </span>
            )}
          </p>
        </div>
      </div>

      {/* PARTICIPANTS LIST */}
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] mb-2">
          ── Participants ──
        </p>
        <ol className="border border-[color:var(--border)] divide-y divide-[color:var(--border)]">
          {participants.map((p) => {
            const mine = p.userId === currentUserId;
            return (
              <li
                key={p.userId}
                className={`flex items-center gap-3 px-3 py-2 font-mono text-xs ${
                  mine
                    ? "bg-[color:var(--neon-cyan)]/10 border-l-2 border-[color:var(--neon-cyan)]"
                    : "border-l-2 border-transparent"
                }`}
              >
                <span className="w-7 text-[color:var(--fg-muted)] tabular-nums text-[11px]">
                  P{p.seat + 1}
                </span>
                <span
                  className={`flex-1 truncate ${mine ? "text-[color:var(--fg)]" : "text-[color:var(--fg-muted)]"}`}
                >
                  {p.name ?? "Unknown"}
                  {mine && (
                    <span className="ml-1.5 text-[9px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                      you
                    </span>
                  )}
                </span>
              </li>
            );
          })}
          {/* Empty seats placeholder so the list shows the full slot count */}
          {Array.from({ length: room.maxPlayers - seatsFilled }).map((_, i) => (
            <li
              key={`empty-${i}`}
              className="flex items-center gap-3 px-3 py-2 font-mono text-xs text-[color:var(--fg-muted)] opacity-50"
            >
              <span className="w-7 tabular-nums text-[11px]">
                P{seatsFilled + i + 1}
              </span>
              <span className="flex-1 italic">waiting...</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onLeave}
          disabled={busy}
          className="font-mono text-xs uppercase tracking-[0.25em] py-3 border border-[color:var(--neon-magenta)] text-[color:var(--neon-magenta)] hover:bg-[color:var(--neon-magenta)]/10 transition disabled:opacity-40"
        >
          ← Leave
        </button>
        <button
          onClick={onStart}
          disabled={busy || !canStart}
          className="font-mono text-xs uppercase tracking-[0.25em] py-3 text-black transition hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: canStart ? "var(--neon-cyan)" : "var(--surface-3, #444)",
            boxShadow: canStart ? "0 0 20px -4px var(--neon-cyan)" : "none",
          }}
          title={canStart ? "Start the match" : "Waiting for more players"}
        >
          Start →
        </button>
      </div>
    </>
  );
}
