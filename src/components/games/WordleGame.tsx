"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";

const MAX_GUESSES = 6;
const WORD_LEN = 5;
const LOSS_SENTINEL = 7;

// Cache for dictionary lookups within this session — a real word stays
// valid forever and a non-word stays invalid, so we never re-check.
const validCache = new Map<string, boolean>();

async function isRealWord(word: string): Promise<boolean> {
  const cached = validCache.get(word);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );
    const ok = res.ok;
    validCache.set(word, ok);
    return ok;
  } catch {
    // Network blip — be permissive rather than blocking play.
    return true;
  }
}

type Status = "correct" | "present" | "absent" | "empty";

function evalGuess(guess: string, target: string): Status[] {
  const result: Status[] = Array(WORD_LEN).fill("absent");
  const remaining: (string | null)[] = target.split("");
  // greens first
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === target[i]) {
      result[i] = "correct";
      remaining[i] = null;
    }
  }
  // yellows
  for (let i = 0; i < WORD_LEN; i++) {
    if (result[i] === "correct") continue;
    const idx = remaining.indexOf(guess[i]);
    if (idx !== -1) {
      result[i] = "present";
      remaining[idx] = null;
    }
  }
  return result;
}

// Fixed Wordle palette — intentionally NOT theme-derived so the game reads
// the same in every theme/mode.
function tileStyle(s: Status): React.CSSProperties {
  switch (s) {
    case "correct":
      return { background: "#6aaa64", color: "#fff", borderColor: "#6aaa64" };
    case "present":
      return { background: "#c9b458", color: "#fff", borderColor: "#c9b458" };
    case "absent":
      return { background: "#787c7e", color: "#fff", borderColor: "#787c7e" };
    default:
      return { background: "transparent", color: "#e4e4e4", borderColor: "#3a3a3c" };
  }
}

interface PriorResult {
  score: number;
  guessCount: number;
  outcome: "win" | "loss";
  target: string;
}

export default function WordleGame({ onGameEnd }: GameProps) {
  // The day's word comes from the server (picked from a live dictionary
  // corpus, hashed by date so everyone on this day gets the same word).
  const targetRef = useRef<string>("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState<"win" | "loss" | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [prior, setPrior] = useState<PriorResult | null>(null);
  const endedRef = useRef(false);

  // Parallel: daily-play lock check + today's word fetch. One loading state
  // covers both so the game doesn't render until we have everything.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statusRes, wordRes] = await Promise.all([
          fetch("/api/games/19/dailyStatus", { cache: "no-store" }),
          fetch("/api/games/19/dailyWord", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (wordRes.ok) {
          const { word } = await wordRes.json();
          if (typeof word === "string") targetRef.current = word.toLowerCase();
        }
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.playedToday && data.metadata) {
            setPrior({
              score: data.score,
              guessCount: (data.metadata.guessCount as number) ?? 0,
              outcome: (data.metadata.outcome as "win" | "loss") ?? "loss",
              target: (data.metadata.target as string) ?? targetRef.current,
            });
          }
        }
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async () => {
    if (done || checking || prior || draft.length !== WORD_LEN) return;
    const g = draft.toLowerCase();
    setChecking(true);
    const ok = await isRealWord(g);
    setChecking(false);
    if (!ok) {
      setInvalid(true);
      window.setTimeout(() => setInvalid(false), 800);
      return;
    }
    const next = [...guesses, g];
    setGuesses(next);
    setDraft("");
    if (g === targetRef.current) setDone("win");
    else if (next.length >= MAX_GUESSES) setDone("loss");
  }, [done, checking, draft, guesses]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || prior) return;
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Backspace") {
        setDraft((d) => d.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key) && draft.length < WORD_LEN) {
        setDraft((d) => (d + e.key).toLowerCase());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, prior, draft, submit]);

  useEffect(() => {
    if (!done || endedRef.current) return;
    endedRef.current = true;
    const score = done === "win" ? guesses.length : LOSS_SENTINEL;
    onGameEnd(score, {
      outcome: done,
      target: targetRef.current,
      guessCount: guesses.length,
    });
  }, [done, guesses.length, onGameEnd]);

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => {
    if (r < guesses.length) {
      const g = guesses[r];
      const evals = evalGuess(g, targetRef.current);
      return g.split("").map((c, i) => ({ letter: c.toUpperCase(), status: evals[i] }));
    }
    if (r === guesses.length && !done) {
      return Array.from({ length: WORD_LEN }, (_, i) => ({
        letter: (draft[i] ?? "").toUpperCase(),
        status: "empty" as Status,
      }));
    }
    return Array.from({ length: WORD_LEN }, () => ({ letter: "", status: "empty" as Status }));
  });

  if (loadingStatus) {
    return (
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)] py-12 text-center">
        <span className="blink">●</span> checking daily…
      </p>
    );
  }

  if (prior) return <DailyLeaderboard />;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        Guess {guesses.length}/{MAX_GUESSES}
        {done && (
          <span className="ml-3 text-[color:var(--neon-cyan)]">
            {done === "win"
              ? `▸ solved in ${guesses.length}`
              : `▸ word was ${targetRef.current.toUpperCase()}`}
          </span>
        )}
      </div>
      <div className="grid grid-rows-6 gap-1.5">
        {rows.map((row, ri) => (
          <div
            key={ri}
            className={`grid grid-cols-5 gap-1.5 ${invalid && ri === guesses.length ? "animate-pulse" : ""}`}
          >
            {row.map((tile, ci) => (
              <div
                key={ci}
                style={tileStyle(tile.status)}
                className="w-12 h-12 sm:w-14 sm:h-14 border-2 flex items-center justify-center font-display font-black text-2xl transition"
              >
                {tile.letter}
              </div>
            ))}
          </div>
        ))}
      </div>
      {invalid && (
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#ff6b6b]">
          ✕ not a real word
        </p>
      )}
      {checking && !invalid && (
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
          <span className="blink">●</span> checking…
        </p>
      )}
      {done && (
        <div className="px-4 py-2 border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] font-mono text-xs text-center">
          <span className="text-[color:var(--fg-muted)] uppercase tracking-[0.22em]">Answer · </span>
          <span className="font-display font-black text-lg tracking-[0.2em] text-[color:var(--neon-cyan)]">
            {targetRef.current.toUpperCase()}
          </span>
        </div>
      )}
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] text-center">
        type letters · enter to submit · backspace to delete · one word per day
      </p>
    </div>
  );
}

// ---- Daily leaderboard view --------------------------------------------
// Shown in place of the board when the user has already played today.
// Pulls today's leaderboard (the route already filters to UTC-day rows for
// games with dailyReset).
interface Entry {
  rank: number;
  userId: string;
  name: string;
  score: number;
}

function DailyLeaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    fetch("/api/games/19/leaderboard?limit=20", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]));
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto border border-[color:var(--border-strong)] bg-[color:var(--surface-1)]">
      <div className="px-4 py-2 border-b border-[color:var(--border)] bg-[color:var(--surface-2)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
          ▸ Today's Leaderboard
        </p>
      </div>
      {entries === null ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] py-8 text-center">
          <span className="blink">●</span> loading
        </p>
      ) : entries.length === 0 ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)] py-8 text-center">
          &gt; no entries yet
        </p>
      ) : (
        <ol className="divide-y divide-[color:var(--border)]">
          {entries.map((e) => (
            <li
              key={e.userId}
              className="flex items-center gap-3 px-4 py-2 font-mono text-xs"
            >
              <span className="w-7 text-[color:var(--fg-muted)] tabular-nums">
                {String(e.rank).padStart(2, "0")}
              </span>
              <span className="flex-1 truncate text-[color:var(--fg)]">{e.name}</span>
              <span className="tabular-nums font-bold text-[color:var(--neon-cyan)]">
                {e.score === LOSS_SENTINEL ? "—" : `${e.score}/6`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
