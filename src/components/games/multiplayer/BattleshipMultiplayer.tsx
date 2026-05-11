"use client";

// Battleship — multiplayer client.
//
// Architecture:
//   - Each player auto-places ships LOCALLY. Positions never go on the wire,
//     so opponent literally can't peek even with DevTools — the server has
//     no record of where your ships are.
//   - Move-log payloads:
//       { type: "ready" }                    — placement done, accept fires
//       { type: "fire", x, y }               — I'm shooting at (x, y)
//       { type: "result", x, y, hit, sunk }  — defender's response
//   - Sequence: P1 fires → P2 (defender) checks own grid, posts result →
//     P2 fires → P1 posts result → ...
//   - Win: when one side has scored hits == sum of opponent ship lengths.

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

// Ship spec — keep it small for a more dynamic match.
const SHIPS = [
  { name: "Carrier", len: 5 },
  { name: "Battleship", len: 4 },
  { name: "Cruiser", len: 3 },
  { name: "Destroyer", len: 2 },
];
const TOTAL_HIT_TARGET = SHIPS.reduce((a, s) => a + s.len, 0); // = 14
const BOARD_SIZE = 10;
const POLL_MS = 500;

type Orientation = "h" | "v";
interface PlacedShip {
  name: string;
  x: number;       // top-left
  y: number;
  len: number;
  orientation: Orientation;
}

type FirePayload = { type: "fire"; x: number; y: number };
type ResultPayload = {
  type: "result";
  x: number;
  y: number;
  hit: boolean;
  sunk: string | null;
};
type ReadyPayload = { type: "ready" };
type GameStartPayload = { type: "game-start" };
type RematchVotePayload = { type: "rematch-vote" };
type ForfeitPayload = { type: "forfeit" };
type MovePayload =
  | FirePayload
  | ResultPayload
  | ReadyPayload
  | GameStartPayload
  | RematchVotePayload
  | ForfeitPayload;

interface MoveRow {
  moveNumber: number;
  senderId: string | null;
  payload: MovePayload;
}

// ---- Auto-placement ---------------------------------------------------
function randomPlacement(): PlacedShip[] {
  // Generate non-overlapping random placements. Try-and-retry is fine for
  // 4 ships on a 10x10 board — collisions are rare.
  const cells = new Set<string>();
  const placed: PlacedShip[] = [];
  for (const ship of SHIPS) {
    let tries = 0;
    while (tries++ < 200) {
      const orientation: Orientation = Math.random() < 0.5 ? "h" : "v";
      const x = Math.floor(Math.random() * (orientation === "h" ? BOARD_SIZE - ship.len + 1 : BOARD_SIZE));
      const y = Math.floor(Math.random() * (orientation === "v" ? BOARD_SIZE - ship.len + 1 : BOARD_SIZE));
      const occupied: string[] = [];
      for (let i = 0; i < ship.len; i++) {
        const cx = orientation === "h" ? x + i : x;
        const cy = orientation === "v" ? y + i : y;
        occupied.push(`${cx},${cy}`);
      }
      if (occupied.some((c) => cells.has(c))) continue;
      occupied.forEach((c) => cells.add(c));
      placed.push({ ...ship, x, y, orientation });
      break;
    }
  }
  return placed;
}

function shipCells(s: PlacedShip): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < s.len; i++) {
    out.push(s.orientation === "h" ? [s.x + i, s.y] : [s.x, s.y + i]);
  }
  return out;
}

function checkHit(
  ships: PlacedShip[],
  x: number,
  y: number,
  hitsByShip: Map<string, number>,
): { hit: boolean; sunkShip: string | null } {
  for (const s of ships) {
    if (shipCells(s).some(([cx, cy]) => cx === x && cy === y)) {
      const newCount = (hitsByShip.get(s.name) ?? 0) + 1;
      hitsByShip.set(s.name, newCount);
      const sunk = newCount >= s.len ? s.name : null;
      return { hit: true, sunkShip: sunk };
    }
  }
  return { hit: false, sunkShip: null };
}

export default function BattleshipMultiplayer({
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

  // ---- Local secret state ---------------------------------------------
  // Generated once on mount; stays in this component the entire session.
  // Re-randomized on rematch.
  const [myShips, setMyShips] = useState<PlacedShip[]>(() => randomPlacement());
  const [iAmReady, setIAmReady] = useState(false);
  // Hit counter for each of my ships (so we know when one is sunk).
  const myShipHitsRef = useRef<Map<string, number>>(new Map());

  // ---- Polling (count-based cache) -------------------------------------
  // We send our last-known count; server returns `unchanged: true` and
  // skips the moves SELECT when nothing's new. Cache hits are essentially
  // free.
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
    } catch {
      /* network blip */
    }
  }, [gameId, sessionId]);

  useEffect(() => {
    fetchMoves();
    const t = setInterval(fetchMoves, POLL_MS);
    return () => clearInterval(t);
  }, [fetchMoves]);

  // ---- Identify self via vote senderId (after I cast one), else infer
  const opponent = participants.find((p) => p.seat !== mySeat);
  const me = participants.find((p) => p.seat === mySeat);
  const opponentName = opponent?.name ?? "Opponent";
  const myUserId = me?.userId ?? null;
  const opponentUserId = opponent?.userId ?? null;

  // ---- Derived game state from moves ----------------------------------
  // Categorize moves once per render. Cheap — usually <30 entries even
  // in a long game.
  const ready = useMemo(() => {
    const set = new Set<string>();
    for (const m of moves) {
      if (m.payload?.type === "ready" && m.senderId) set.add(m.senderId);
    }
    return set;
  }, [moves]);

  const fires = useMemo(
    () =>
      moves.filter(
        (m): m is MoveRow & { payload: FirePayload } =>
          m.payload?.type === "fire",
      ),
    [moves],
  );
  const results = useMemo(
    () =>
      moves.filter(
        (m): m is MoveRow & { payload: ResultPayload } =>
          m.payload?.type === "result",
      ),
    [moves],
  );

  const bothReady =
    !!myUserId && !!opponentUserId && ready.has(myUserId) && ready.has(opponentUserId);

  // ---- Fire/result reconciliation -------------------------------------
  // For each fire I see, find its matching result (if any). Pair by order
  // — fire k pairs with result k. The server sequences strictly so this
  // simple zip is reliable.
  const firesWithResults = useMemo(
    () =>
      fires.map((fire, i) => ({
        fire,
        result: results[i] as (MoveRow & { payload: ResultPayload }) | undefined,
      })),
    [fires, results],
  );

  // Whose turn is it? After both ready, P1 (seat 0) fires first. Then
  // alternate. A "turn" is complete when the result has been posted.
  const completedShots = firesWithResults.filter((p) => !!p.result).length;
  const shotInFlight = firesWithResults.length > completedShots;
  const turnSeat = completedShots % 2;

  // ---- Hit tally -------------------------------------------------------
  // Count hits I've LANDED on opponent (results to my fires that came back hit)
  // and hits opponent landed on me (results I posted back to them).
  const myHits = firesWithResults.filter(
    (p) => p.fire.senderId === myUserId && p.result?.payload.hit,
  ).length;
  const opponentHits = firesWithResults.filter(
    (p) => p.fire.senderId === opponentUserId && p.result?.payload.hit,
  ).length;

  // ---- Forfeit detection ---------------------------------------------
  // If either player bailed, gameOver flips immediately and the
  // remaining player gets a "win by forfeit" overlay rather than waiting
  // on a turn that won't come.
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

  // ---- Win detection --------------------------------------------------
  const iWonHits = myHits >= TOTAL_HIT_TARGET;
  const iLostHits = opponentHits >= TOTAL_HIT_TARGET;
  const iWon = iWonHits || opponentForfeited;
  const iLost = iLostHits || iForfeited;
  const gameOver = iWon || iLost;

  // Stats: report outcome once per game-end. Resets on rematch so
  // subsequent rounds report independently.
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
  const myTurn =
    bothReady && !gameOver && turnSeat === mySeat && !shotInFlight;

  // ---- Defender side: respond to opponent's pending fire --------------
  // If a fire from the opponent is awaiting a result and the result is
  // mine to post, post it. Run as an effect so we react to new fires
  // arriving via polling.
  const respondingRef = useRef(false);
  useEffect(() => {
    if (!bothReady || gameOver) return;
    if (respondingRef.current) return;
    const pending = firesWithResults.find(
      (p) => !p.result && p.fire.senderId === opponentUserId,
    );
    if (!pending) return;
    respondingRef.current = true;
    (async () => {
      try {
        // Run the hit check against MY local ships. The opponent never
        // sees my placement — they only see this result row.
        const { x, y } = pending.fire.payload;
        const { hit, sunkShip } = checkHit(myShips, x, y, myShipHitsRef.current);
        const payload: ResultPayload = {
          type: "result",
          x,
          y,
          hit,
          sunk: sunkShip,
        };
        await fetch(`/api/games/${gameId}/multiplayer/moves`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, payload }),
        });
        await fetchMoves();
      } finally {
        respondingRef.current = false;
      }
    })();
  }, [
    firesWithResults,
    bothReady,
    gameOver,
    opponentUserId,
    myShips,
    gameId,
    sessionId,
    fetchMoves,
  ]);

  // ---- Stage end-of-game overlay --------------------------------------
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

  // ---- Submit "ready" --------------------------------------------------
  const submitReady = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/multiplayer/moves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          payload: { type: "ready" } satisfies ReadyPayload,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        setError(`Ready failed: ${raw.slice(0, 200)}`);
        return;
      }
      setIAmReady(true);
      await fetchMoves();
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Fire at a cell --------------------------------------------------
  const fire = async (x: number, y: number) => {
    if (!myTurn) return;
    // Don't allow firing at a cell I've already shot.
    const alreadyShot = firesWithResults.some(
      (p) =>
        p.fire.senderId === myUserId &&
        p.fire.payload.x === x &&
        p.fire.payload.y === y,
    );
    if (alreadyShot) {
      setError("You already shot there.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: FirePayload = { type: "fire", x, y };
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

  // ---- Rematch (shared hook) -------------------------------------------
  // Reset both the move log AND all the local secret state (ships, hits).
  const handleResetLocal = useCallback(() => {
    setMyShips(randomPlacement());
    setIAmReady(false);
    myShipHitsRef.current = new Map();
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
      // Same forfeit-then-leave flow as the other MP games. Posted
      // before gameRoom DELETE so isFull is still true and the post
      // passes the server's "game must be running" check.
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

  // ---- Render helpers --------------------------------------------------
  // Build cell-state maps for both grids.
  // My grid: show my ships + opponent's hits/misses on me.
  // Opponent grid: show MY shots only (hit/miss/pending).
  const myShipCells = useMemo(() => {
    const set = new Set<string>();
    for (const s of myShips) for (const [x, y] of shipCells(s)) set.add(`${x},${y}`);
    return set;
  }, [myShips]);

  const opponentShotsOnMe = useMemo(() => {
    const map = new Map<string, "hit" | "miss" | "pending">();
    for (const p of firesWithResults) {
      if (p.fire.senderId !== opponentUserId) continue;
      const key = `${p.fire.payload.x},${p.fire.payload.y}`;
      if (!p.result) map.set(key, "pending");
      else map.set(key, p.result.payload.hit ? "hit" : "miss");
    }
    return map;
  }, [firesWithResults, opponentUserId]);

  const myShotsOnOpponent = useMemo(() => {
    const map = new Map<string, "hit" | "miss" | "pending">();
    for (const p of firesWithResults) {
      if (p.fire.senderId !== myUserId) continue;
      const key = `${p.fire.payload.x},${p.fire.payload.y}`;
      if (!p.result) map.set(key, "pending");
      else map.set(key, p.result.payload.hit ? "hit" : "miss");
    }
    return map;
  }, [firesWithResults, myUserId]);

  // ---- Status line -----------------------------------------------------
  const status = (() => {
    if (!iAmReady) return "Place ships → click Ready.";
    if (!bothReady) return `Waiting for ${opponentName}...`;
    if (iWon) return "All ships sunk. You win.";
    if (iLost) return "Your fleet is gone.";
    if (myTurn) return "Your shot.";
    if (shotInFlight && fires[fires.length - 1]?.senderId === opponentUserId)
      return "Incoming shot...";
    return `${opponentName}'s turn...`;
  })();

  return (
    <div className="relative flex flex-col items-center gap-4">
      {/* HUD */}
      <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        <span>vs {opponentName}</span>
        <span>·</span>
        <span>
          Hits {myHits}/{TOTAL_HIT_TARGET}
        </span>
        <span>·</span>
        <span>
          Damage {opponentHits}/{TOTAL_HIT_TARGET}
        </span>
        <span>·</span>
        <span
          className={
            myTurn || iWon
              ? "text-[color:var(--neon-lime)]"
              : "text-[color:var(--fg-muted)]"
          }
        >
          {status}
        </span>
      </div>

      {/* Pre-game: ship placement */}
      {!iAmReady && (
        <div className="flex flex-col items-center gap-3">
          <Grid
            label="Your fleet"
            cells={(x, y) => {
              const shot = opponentShotsOnMe.get(`${x},${y}`);
              if (shot) return shot;
              return myShipCells.has(`${x},${y}`) ? "ship" : "empty";
            }}
            interactive={false}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setMyShips(randomPlacement())}
              disabled={submitting}
              className="font-mono text-xs uppercase tracking-[0.25em] px-4 py-2 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:border-[color:var(--neon-cyan)] transition disabled:opacity-40"
            >
              ↻ Rearrange
            </button>
            <button
              onClick={submitReady}
              disabled={submitting}
              className="font-mono text-xs uppercase tracking-[0.25em] px-4 py-2 text-black transition hover:brightness-110 disabled:opacity-40"
              style={{
                background: "var(--neon-cyan)",
                boxShadow: "0 0 20px -4px var(--neon-cyan)",
              }}
            >
              ✓ Ready
            </button>
          </div>
        </div>
      )}

      {/* In-game: both grids */}
      {iAmReady && (
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="flex flex-col items-center gap-2">
            <Grid
              label="Your fleet"
              cells={(x, y) => {
                const shot = opponentShotsOnMe.get(`${x},${y}`);
                if (shot) return shot;
                return myShipCells.has(`${x},${y}`) ? "ship" : "empty";
              }}
              interactive={false}
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Grid
              label="Enemy waters"
              cells={(x, y) => myShotsOnOpponent.get(`${x},${y}`) ?? "empty"}
              interactive={myTurn && !submitting}
              onCellClick={fire}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
          ✕ {error}
        </p>
      )}

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
                  ? "FLEET SUNK"
                  : "YOU'RE SUNK"
          }
          subtitle={
            opponentForfeited
              ? `${opponentName} abandoned the match. The waters are yours.`
              : iForfeited
                ? "You left the match — counted as a loss."
                : iWon
                  ? `${opponentName}'s fleet is at the bottom of the ocean.`
                  : `${opponentName} found every last ship.`
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

// ---------------------------------------------------------------------------
// Reusable 10x10 grid renderer. State per cell determines color/symbol.
// ---------------------------------------------------------------------------
type CellState = "empty" | "ship" | "hit" | "miss" | "pending";
function Grid({
  label,
  cells,
  interactive,
  onCellClick,
}: {
  label: string;
  cells: (x: number, y: number) => CellState;
  interactive: boolean;
  onCellClick?: (x: number, y: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
        {label}
      </p>
      <div
        className="grid gap-[2px] p-1 border border-[color:var(--border-strong)] bg-[color:var(--surface-2)]"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, idx) => {
          const x = idx % BOARD_SIZE;
          const y = Math.floor(idx / BOARD_SIZE);
          const state = cells(x, y);
          const cls = (() => {
            switch (state) {
              case "ship":
                return "bg-[color:var(--neon-cyan)]/30 border-[color:var(--neon-cyan)]";
              case "hit":
                return "bg-[color:var(--neon-magenta)] border-[color:var(--neon-magenta)] text-black";
              case "miss":
                return "bg-[color:var(--surface-3,#222)] border-[color:var(--border)] text-[color:var(--fg-muted)]";
              case "pending":
                return "bg-[color:var(--neon-yellow)]/30 border-[color:var(--neon-yellow)]";
              default:
                return interactive
                  ? "bg-[color:var(--surface-1)] border-[color:var(--border)] hover:border-[color:var(--neon-cyan)] cursor-pointer"
                  : "bg-[color:var(--surface-1)] border-[color:var(--border)]";
            }
          })();
          const symbol =
            state === "hit" ? "✕" : state === "miss" ? "·" : state === "pending" ? "?" : "";
          return (
            <button
              key={idx}
              onClick={() => onCellClick?.(x, y)}
              disabled={!interactive || state !== "empty"}
              className={`w-6 h-6 sm:w-7 sm:h-7 border text-xs font-mono flex items-center justify-center transition ${cls}`}
            >
              {symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}

