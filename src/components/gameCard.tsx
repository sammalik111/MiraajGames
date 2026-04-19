"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

interface GameCardProps {
  id: number;
  title: string;
  description: string;
  creator: string;
  theme: string;
}

const themeStyles: Record<string, string> = {
  platformer: "from-orange-500 via-rose-500 to-pink-500",
  pool: "from-sky-500 via-cyan-500 to-teal-500",
  shooter: "from-emerald-500 via-lime-500 to-yellow-500",
  chess: "from-slate-600 via-slate-500 to-slate-400",
  puzzle: "from-fuchsia-500 via-violet-500 to-indigo-500",
  strategy: "from-blue-500 via-indigo-500 to-purple-500",
  arcade: "from-red-500 via-pink-500 to-rose-500",
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gameId: id }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Could not update favorites");
        return;
      }

      if (data.action === "removed") {
        setFavoriteIds((prev) => prev.filter((favoriteId) => favoriteId !== id));
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
    <Link href={`/games/${id}`}>
      <div className="group overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-900/95 shadow-2xl shadow-black/20 transition-transform duration-300 hover:-translate-y-1 hover:shadow-violet-500/20">
        <div className={`h-48 bg-gradient-to-br ${themeStyles[theme] ?? "from-slate-700 via-slate-800 to-slate-900"} p-6`}>
          <div className="flex h-full flex-col justify-between text-white">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full bg-white/15 px-3 py-1 text-sm uppercase tracking-[0.3em] text-white/90">
                {title.split(" ")[0]}
              </span>
              <div className="h-12 w-12 rounded-3xl bg-white/10 backdrop-blur-xl" />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold leading-tight">{title}</p>
              <p className="max-w-[80%] text-sm text-white/80">{description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 pb-6 pt-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>By {creator}</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">{isFavorited ? "★" : "☆"}</span>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                router.push(`/games/${id}`);
              }}
              className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Launch Game
            </button>
            <button
              type="button"
              onClick={handleFavorite}
              disabled={isFavoriting}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${isFavorited ? "bg-emerald-500 text-white hover:bg-emerald-400" : "bg-slate-800 text-slate-100 hover:bg-slate-700"}`}
            >
              {isFavorited ? "Favorited" : "Add to favorites"}
            </button>
          </div>

          {message && <p className="text-xs text-slate-400">{message}</p>}
        </div>
      </div>
    </Link>
  );
}
