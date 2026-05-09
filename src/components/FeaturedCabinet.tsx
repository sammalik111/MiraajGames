"use client";

// Featured cabinet on the home page hero. Auto-rotates through the
// games array every 6 seconds so the right side of the hero never gets
// stale. Click anywhere to navigate to that cabinet's page.
//
// Pure client component — the games array is small (18 entries), passed
// in as a prop. No fetches, no server round-trips.

import HudPanel from "@/components/HudPanel";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Game {
  id: number;
  title: string;
  description: string;
  creator: string;
  theme: string;
  grouping?: string;
}

interface Props {
  games: Game[];
}

const ROTATE_MS = 6000;

export default function FeaturedCabinet({ games }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Pick a random starting cabinet on mount so the hero feels fresh
  // even on a page refresh. After mount, advance linearly.
  useEffect(() => {
    setIndex(Math.floor(Math.random() * games.length));
  }, [games.length]);

  // Auto-rotate. Pauses on hover so the user can read the card without
  // it sliding away.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % games.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, games.length]);

  const game = games[index];
  if (!game) return null;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Link href={`/games/${game.id}`} className="block">
        <HudPanel accent="magenta" innerClassName="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                &gt; Featured Cabinet
              </p>
              <h2 className="font-display font-bold text-2xl mt-2 text-[color:var(--fg)] truncate">
                {game.title}
              </h2>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                Status
              </p>
              <p className="font-mono text-sm text-[color:var(--neon-cyan)] dark:glow-cyan mt-1">
                <span className="blink">●</span> LIVE
              </p>
            </div>
          </div>

          <p className="text-sm text-[color:var(--fg-muted)] leading-relaxed line-clamp-3">
            {game.description}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { k: "Theme", v: game.theme },
              { k: "Mode", v: game.grouping ?? "—" },
              { k: "Author", v: game.creator },
              { k: "ID", v: `#${String(game.id).padStart(2, "0")}` },
            ].map((item) => (
              <div
                key={item.k}
                className="border-l-2 border-[color:var(--neon-cyan)] pl-3 min-w-0"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
                  {item.k}
                </p>
                <p className="text-sm text-[color:var(--fg)] truncate">{item.v}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
              Open cabinet →
            </p>
            {/* Rotation pip indicator — shows position in the carousel */}
            <div className="flex gap-1">
              {games.slice(0, Math.min(games.length, 8)).map((_, i) => {
                const myIdx = i;
                const active =
                  myIdx === index % Math.min(games.length, 8);
                return (
                  <span
                    key={i}
                    aria-hidden
                    className={`block h-1 transition-all ${
                      active
                        ? "w-4 bg-[color:var(--neon-cyan)]"
                        : "w-1.5 bg-[color:var(--border-strong)]"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </HudPanel>
      </Link>
    </div>
  );
}
