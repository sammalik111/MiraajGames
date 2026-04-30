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

// Overlay shown when a run ends. Three sections:
//   1. Score callout (huge number, accent on whether you topped the board)
//   2. Top 10 list — your row highlighted, podium ranks tinted
//   3. Action row
//
// 250ms delay before fetching the board so the just-submitted score has
// time to land in the DB. Invisible to humans, plenty for a Neon write.
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
  const beatTop = myRow?.rank === 1;
  // Direction-aware "you didn't make top 10" only fires once data is in.
  const inTop10 = !!myRow;

  // Headline color cue: gold if #1, cyan if in top 10, magenta otherwise.
  const headlineColor = beatTop
    ? "var(--neon-yellow)"
    : inTop10
      ? "var(--neon-cyan)"
      : "var(--neon-magenta)";
  const headlineText = beatTop ? "HIGH SCORE" : inTop10 ? "RANKED" : "RUN OVER";

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-[2px] p-4">
      <div
        className="w-full max-w-sm border bg-[color:var(--surface-1)] shadow-[0_0_60px_-10px_rgba(0,255,255,0.4)]"
        style={{
          borderColor: headlineColor,
          clipPath:
            "polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))",
        }}
      >
        {/* Header strip */}
        <div
          className="px-5 py-2 flex items-center justify-between"
          style={{
            background: `linear-gradient(90deg, ${headlineColor}22, transparent)`,
            borderBottom: `1px solid ${headlineColor}44`,
          }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.3em]"
            style={{ color: headlineColor }}
          >
            ▸ {headlineText}
          </span>
          {myRow && (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.3em]"
              style={{ color: headlineColor }}
            >
              RANK #{myRow.rank}
            </span>
          )}
        </div>

        {/* Score */}
        <div className="px-5 pt-5 pb-4 text-center">
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
            ── Final Score ──
          </p>
          <p
            className="font-display font-black text-6xl mt-1 leading-none tabular-nums"
            style={{
              color: headlineColor,
              textShadow: `0 0 24px ${headlineColor}88`,
            }}
          >
            {score.toLocaleString()}
          </p>
        </div>

        {/* Leaderboard */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
              Top 10
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
              {isDesc ? "↓ HIGH" : "↑ LOW"}
            </span>
          </div>

          <div className="border-t border-[color:var(--border)]">
            {loading ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] py-6 text-center">
                <span className="blink">●</span> Syncing scores
              </p>
            ) : entries && entries.length > 0 ? (
              <ol className="divide-y divide-[color:var(--border)] max-h-[220px] overflow-y-auto">
                {entries.map((e) => {
                  const mine = e.userId === userId;
                  const podium = e.rank <= 3;
                  const rankColor =
                    e.rank === 1
                      ? "var(--neon-yellow)"
                      : e.rank === 2
                        ? "var(--neon-cyan)"
                        : e.rank === 3
                          ? "var(--neon-magenta)"
                          : "var(--fg-muted)";
                  return (
                    <li
                      key={e.userId}
                      className="flex items-center gap-3 px-2 py-2 font-mono text-xs"
                      style={
                        mine
                          ? {
                              background: `${headlineColor}18`,
                              boxShadow: `inset 3px 0 0 ${headlineColor}`,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="font-display font-black text-sm w-7 tabular-nums"
                        style={{ color: rankColor }}
                      >
                        {String(e.rank).padStart(2, "0")}
                      </span>
                      <span
                        className={`flex-1 truncate ${podium ? "text-[color:var(--fg)]" : "text-[color:var(--fg-muted)]"}`}
                      >
                        {e.name}
                        {mine && (
                          <span
                            className="ml-1 text-[9px] uppercase tracking-[0.25em]"
                            style={{ color: headlineColor }}
                          >
                            · you
                          </span>
                        )}
                      </span>
                      <span
                        className="font-display font-bold tabular-nums"
                        style={{ color: mine ? headlineColor : "var(--fg)" }}
                      >
                        {e.score.toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] py-6 text-center">
                &gt; First on the board
              </p>
            )}
          </div>

          {!loading && !inTop10 && entries && entries.length > 0 && (
            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] text-center">
              ✕ Outside top 10 · run it back
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-1">
          <button
            onClick={onRetry}
            className="w-full font-mono text-xs uppercase tracking-[0.3em] py-3 text-black transition hover:brightness-110"
            style={{
              background: headlineColor,
              boxShadow: `0 0 20px -4px ${headlineColor}`,
            }}
          >
            ↻ Run Again
          </button>
        </div>
      </div>
    </div>
  );
}
