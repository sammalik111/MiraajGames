"use client";

import React, { useEffect, useState, useCallback } from "react";

// ── Level Config ───────────────────────────────────────────────────────────

interface LevelConfig {
  cols: number;
  rows: number;
  emojis: string[];
}

const ALL_EMOJIS = ["🎮", "🎯", "🎲", "🎪", "🎨", "🎭", "🎸", "🎺", "🦁", "🐯", "🌟", "🚀"];

const LEVELS: LevelConfig[] = [
  { cols: 3, rows: 4, emojis: ALL_EMOJIS.slice(0, 6) },   // Level 1: 3×4, 6 pairs
  { cols: 4, rows: 4, emojis: ALL_EMOJIS.slice(0, 8) },   // Level 2: 4×4, 8 pairs
  { cols: 5, rows: 4, emojis: ALL_EMOJIS.slice(0, 10) },  // Level 3: 5×4, 10 pairs
  { cols: 6, rows: 4, emojis: ALL_EMOJIS.slice(0, 12) },  // Level 4: 6×4, 12 pairs
];

// ── Types ──────────────────────────────────────────────────────────────────

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(level: LevelConfig): Card[] {
  const pairs = [...level.emojis, ...level.emojis];
  return shuffle(pairs).map((emoji, idx) => ({
    id: idx,
    emoji,
    flipped: false,
    matched: false,
  }));
}

// ── Ad Placeholder ─────────────────────────────────────────────────────────

function AdPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-slate-500 font-semibold tracking-widest uppercase">
        Advertisement
      </span>
      <div
        className="rounded border border-slate-600 bg-slate-800 flex items-center justify-center text-slate-500 text-sm font-medium"
        style={{ width: 300, height: 250 }}
      >
        300 × 250 Ad
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MemoryGame() {
  const [currentLevel, setCurrentLevel] = useState(0); // 0-based index
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [bestMoves, setBestMoves] = useState<(number | null)[]>([null, null, null, null]);
  const [levelOverlay, setLevelOverlay] = useState<string | null>(null);
  const [gameWon, setGameWon] = useState(false);

  const levelConfig = LEVELS[currentLevel];

  const initLevel = useCallback((lvlIdx: number) => {
    setCards(buildDeck(LEVELS[lvlIdx]));
    setFlipped([]);
    setLocked(false);
    setMoves(0);
  }, []);

  useEffect(() => {
    initLevel(currentLevel);
  }, [currentLevel, initLevel]);

  // Check win after card state updates
  useEffect(() => {
    if (cards.length === 0) return;
    if (cards.every((c) => c.matched)) {
      // Record best moves
      setBestMoves((prev) => {
        const next = [...prev];
        if (next[currentLevel] === null || moves < (next[currentLevel] as number)) {
          next[currentLevel] = moves;
        }
        return next;
      });

      if (currentLevel === LEVELS.length - 1) {
        setGameWon(true);
      } else {
        const msg = `Level ${currentLevel + 1} complete! 🎉`;
        setLevelOverlay(msg);
        setTimeout(() => {
          setLevelOverlay(null);
          setCurrentLevel((l) => l + 1);
        }, 1800);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  const handleCardClick = (id: number) => {
    if (locked) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;
    if (flipped.length === 2) return;

    const newFlipped = [...flipped, id];
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, flipped: true } : c)));
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = newFlipped.map((fid) => cards.find((c) => c.id === fid)!);
      if (a.emoji === b.emoji) {
        // Match!
        setCards((prev) =>
          prev.map((c) => (newFlipped.includes(c.id) ? { ...c, matched: true, flipped: true } : c))
        );
        setFlipped([]);
      } else {
        // No match — lock and flip back after 900ms
        setLocked(true);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) => (newFlipped.includes(c.id) && !c.matched ? { ...c, flipped: false } : c))
          );
          setFlipped([]);
          setLocked(false);
        }, 900);
      }
    }
  };

  const CARD_SIZE = 84;

  if (gameWon) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-3">🏆</div>
          <h2 className="text-3xl font-bold text-white mb-2">You beat all 4 levels! 🏆</h2>
          <p className="text-slate-400 mb-2">Total moves on final level: {moves}</p>
          <div className="mb-6 text-sm text-slate-500">
            {LEVELS.map((_, i) => (
              <div key={i}>
                Level {i + 1} best: {bestMoves[i] ?? "—"} moves
              </div>
            ))}
          </div>
          <button
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
            onClick={() => { setCurrentLevel(0); setGameWon(false); setBestMoves([null, null, null, null]); }}
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Memory Match</h1>
            <p className="text-slate-400 text-sm">
              Find all matching pairs
            </p>
          </div>
          <div className="bg-slate-700 rounded-xl px-5 py-2 text-center">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Level</div>
            <div className="text-2xl font-bold text-yellow-400">
              {currentLevel + 1} / {LEVELS.length}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800 rounded-lg px-4 py-2 mb-5 text-sm text-slate-300">
          Click two cards to flip them. Match all pairs to advance to the next level.
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Game area */}
          <div className="flex-1">
            {/* Stats */}
            <div className="flex gap-6 mb-5">
              <div className="bg-slate-800 rounded-lg px-4 py-3 text-center flex-1">
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Moves</div>
                <div className="text-2xl font-bold text-white">{moves}</div>
              </div>
              <div className="bg-slate-800 rounded-lg px-4 py-3 text-center flex-1">
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Best</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {bestMoves[currentLevel] ?? "—"}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg px-4 py-3 text-center flex-1">
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Pairs Left</div>
                <div className="text-2xl font-bold text-blue-400">
                  {levelConfig.emojis.length - cards.filter((c) => c.matched).length / 2}
                </div>
              </div>
            </div>

            {/* Card grid */}
            <div className="relative">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${levelConfig.cols}, ${CARD_SIZE}px)`,
                  gap: 10,
                  width: "fit-content",
                }}
              >
                {cards.map((card) => {
                  const isVisible = card.flipped || card.matched;
                  return (
                    <button
                      key={card.id}
                      onClick={() => handleCardClick(card.id)}
                      disabled={card.matched || locked}
                      style={{ width: CARD_SIZE, height: CARD_SIZE }}
                      className={`
                        relative rounded-xl text-3xl font-bold select-none transition-all duration-300
                        ${card.matched
                          ? "bg-green-700 opacity-60 cursor-default scale-95"
                          : isVisible
                            ? "bg-slate-600 cursor-default"
                            : "bg-blue-700 hover:bg-blue-600 cursor-pointer active:scale-95"
                        }
                        flex items-center justify-center
                      `}
                    >
                      {isVisible ? card.emoji : "?"}
                    </button>
                  );
                })}
              </div>

              {/* Level complete overlay */}
              {levelOverlay && (
                <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center rounded-xl">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-2">{levelOverlay}</div>
                    <div className="text-slate-300 text-sm">Loading level {currentLevel + 2}…</div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <button
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
                onClick={() => initLevel(currentLevel)}
              >
                Restart Level
              </button>
            </div>

            {/* Ad placeholder below controls */}
            <div className="mt-6">
              <AdPlaceholder />
            </div>
          </div>

          {/* Right: level info */}
          <div className="flex-shrink-0 w-56">
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wide">Levels</h3>
              {LEVELS.map((lv, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 py-1.5 text-sm border-b border-slate-700 last:border-0 ${
                    i === currentLevel ? "text-yellow-400 font-bold" : "text-slate-500"
                  }`}
                >
                  <span className="w-16">{lv.cols}×{lv.rows}</span>
                  <span>{lv.emojis.length} pairs</span>
                  {i < currentLevel && <span className="text-green-400 ml-auto">✓</span>}
                  {i === currentLevel && (
                    <span className="text-xs bg-yellow-400 text-slate-900 px-1 rounded ml-auto">now</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}