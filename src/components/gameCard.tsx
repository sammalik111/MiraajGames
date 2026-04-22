"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import HudPanel from "@/components/HudPanel";

interface GameCardProps {
  id: number;
  title: string;
  description: string;
  creator: string;
  theme: string;
}

// Map each theme tag to a neon accent color var.
const themeAccent: Record<string, string> = {
  platformer: "var(--neon-magenta)",
  pool: "var(--neon-cyan)",
  shooter: "var(--neon-lime)",
  chess: "var(--fg-muted)",
  puzzle: "var(--neon-yellow)",
  strategy: "var(--neon-cyan)",
  arcade: "var(--neon-magenta)",
};

export default function GameCard({
  id,
  title,
  description,
  creator,
  theme,
}: GameCardProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() =>
    Array.isArray((user as any)?.favorites)
      ? [...((user as any).favorites as number[])]
      : []
  );
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sessionFavorites = Array.isArray((user as any)?.favorites)
    ? ((user as any).favorites as number[])
    : [];

  useEffect(() => {
    if (sessionFavorites.length > 0) {
      setFavoriteIds([...sessionFavorites]);
    }
  }, [sessionFavorites]);

  const isFavorited = favoriteIds.includes(id);
  const accent = themeAccent[theme] ?? "var(--neon-cyan)";

  const handleFavorite = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      router.push("/auth/signin");
      return;
    }

    setIsFavoriting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: id }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Could not update favorites");
        return;
      }

      if (data.action === "removed") {
        setFavoriteIds((prev) => prev.filter((fid) => fid !== id));
      } else {
        setFavoriteIds((prev) => Array.from(new Set([...prev, id])));
      }
      setMessage(data.action === "removed" ? "Removed from favorites" : "Added to favorites");
      router.refresh();
    } catch (error) {
      console.error("Favorite error:", error);
      setMessage("Could not update favorites");
    } finally {
      setIsFavoriting(false);
    }
  };

  return (
    <Link href={`/games/${id}`} className="block group">
      <HudPanel innerClassName="p-0 flex flex-col">
        {/* Header strip — accent-tinted band with cabinet id */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]"
          style={{
            background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 14%, transparent) 0%, transparent 70%)`,
          }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: accent }}>
            ▸ {theme}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            cab#{String(id).padStart(2, "0")}
          </span>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 flex-1 flex flex-col">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-1 h-10 w-1 shrink-0"
              style={{ background: accent, boxShadow: `0 0 10px -2px ${accent}` }}
            />
            <div className="min-w-0">
              <h3 className="font-display font-bold text-lg leading-tight text-[color:var(--fg)] group-hover:text-[color:var(--neon-cyan)] transition-colors">
                {title}
              </h3>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)] mt-1">
                by {creator}
              </p>
            </div>
          </div>

          <p className="text-sm leading-6 text-[color:var(--fg-muted)] line-clamp-3">
            {description}
          </p>

          <div className="flex items-center gap-2 pt-2 mt-auto border-t border-[color:var(--border)]">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                router.push(`/games/${id}`);
              }}
              className="flex-1 font-mono text-xs uppercase tracking-[0.2em] px-4 py-2.5 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
            >
              Launch →
            </button>
            <button
              type="button"
              onClick={handleFavorite}
              disabled={isFavoriting}
              aria-label={isFavorited ? "Unfavorite" : "Favorite"}
              className={`font-mono text-xs uppercase tracking-[0.2em] px-3 py-2.5 border transition ${
                isFavorited
                  ? "border-[color:var(--neon-magenta)] text-[color:var(--neon-magenta)] hover:ring-magenta"
                  : "border-[color:var(--border-strong)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] hover:ring-cyan"
              }`}
            >
              {isFavorited ? "★" : "☆"}
            </button>
          </div>

          {message && (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">
              &gt; {message}
            </p>
          )}
        </div>
      </HudPanel>
    </Link>
  );
}
