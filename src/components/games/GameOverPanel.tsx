"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { games } from "@/data/gameData";

interface Entry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  score: number;
  achievedAt: string;
}

interface Props {
  gameId: number;
  score: number;
  metadata?: Record<string, unknown>;
  onRetry: () => void;
}

// Post-run overlay: shows the player's score and the top 10 board.
// Styled to match the rest of the app's HUD panels — single cyan accent,
// thin borders, mono labels — instead of the earlier multi-color treatment.
//
// 250ms delay before fetching so the just-submitted score has settled in
// the DB. Invisible to humans, plenty for a Neon write.
export default function GameOverPanel({ gameId, score, onRetry }: Props) {
  const { userId } = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(true);

  const game = games.find((g) => g.id === gameId);
  const isDesc = game?.sortedOrder === "DESC";

  useEffect(() => {
    let cancelled = false;
    const fetchBoard = async () => {
      await new Promise((r) => setTimeout(r, 250));
      try {
        const res = await fetch(`/api/games/${gameId}/leaderboard?limit=10`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEntries(data.entries ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBoard();
    return () => {
      cancelled = true;
    };
  }, [gameId, score]);

  const myRow = entries?.find((e) => e.userId === userId);
  const inTop10 = !!myRow;
  const beatTop = myRow?.rank === 1;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4"
      style={{ animation: "panelFade 220ms ease-out" }}
    >
      <style jsx>{`
        @keyframes panelFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes panelRise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="w-full max-w-sm border border-[color:var(--border-strong)] bg-[color:var(--surface-1)]"
        style={{ animation: "panelRise 260ms ease-out" }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[color:var(--border)] bg-[color:var(--surface-2)]">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
            ▸ Run Complete
          </span>
          {myRow && (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
              Rank #{myRow.rank}
            </span>
          )}
        </div>

        {/* Score */}
        <div className="px-5 pt-5 pb-4 text-center border-b border-[color:var(--border)]">
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
            {beatTop ? "New high score" : "Final score"}
          </p>
          <p className="font-display font-black text-5xl mt-1 leading-none tabular-nums text-[color:var(--fg)]">
            {score.toLocaleString()}
          </p>
        </div>

        {/* Leaderboard */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
              Top 10
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
              {isDesc ? "high → low" : "low → high"}
            </span>
          </div>

          {loading ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] py-6 text-center">
              <span className="blink">●</span> Syncing scores
            </p>
          ) : entries && entries.length > 0 ? (
            <ol className="border border-[color:var(--border)] divide-y divide-[color:var(--border)] max-h-[240px] overflow-y-auto">
              {entries.map((e) => {
                const mine = e.userId === userId;
                return (
                  <li
                    key={e.userId}
                    className={`flex items-center gap-3 px-3 py-2 font-mono text-xs ${
                      mine
                        ? "bg-[color:var(--neon-cyan)]/10 border-l-2 border-[color:var(--neon-cyan)]"
                        : "border-l-2 border-transparent"
                    }`}
                  >
                    <span className="w-7 text-[color:var(--fg-muted)] tabular-nums text-[11px]">
                      {String(e.rank).padStart(2, "0")}
                    </span>
                    <span
                      className={`flex-1 truncate ${mine ? "text-[color:var(--fg)]" : "text-[color:var(--fg-muted)]"}`}
                    >
                      {e.name}
                      {mine && (
                        <span className="ml-1.5 text-[9px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                          you
                        </span>
                      )}
                    </span>
                    <span
                      className={`tabular-nums font-bold ${mine ? "text-[color:var(--neon-cyan)]" : "text-[color:var(--fg)]"}`}
                    >
                      {e.score.toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] py-6 text-center border border-dashed border-[color:var(--border)]">
              &gt; First on the board
            </p>
          )}

          {!loading && !inTop10 && entries && entries.length > 0 && (
            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] text-center">
              outside top 10 · run it back
            </p>
          )}
        </div>

        {/* Action */}
        <div className="px-4 pb-4">
          <button
            onClick={onRetry}
            className="w-full font-mono text-xs uppercase tracking-[0.25em] py-3 bg-[color:var(--neon-cyan)] text-black hover:brightness-110 transition"
          >
            ↻ Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
