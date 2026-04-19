"use client";

import React, { useEffect, useState } from "react";

const EMOJIS = ["🎮", "🎯", "🎲", "🎪", "🎨", "🎭", "🎸", "🎺"];

interface Card {
  id: number;
  emoji: string;
}

export default function MemoryGame() {
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  const initializeGame = () => {
    const shuffled = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({ id: index, emoji }));
    setCards(shuffled);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setLocked(false);
  };

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped;
    setLocked(true);
    setMoves((m) => m + 1);

    if (cards[a].emoji === cards[b].emoji) {
      setMatched((prev) => [...prev, a, b]);
      setFlipped([]);
      setLocked(false);
    } else {
      const timer = window.setTimeout(() => {
        setFlipped([]);
        setLocked(false);
      }, 900);
      return () => window.clearTimeout(timer);
    }
  }, [flipped, cards]);

  const handleCardClick = (id: number) => {
    if (locked) return;
    if (flipped.includes(id) || matched.includes(id)) return;
    if (flipped.length >= 2) return;
    setFlipped((prev) => [...prev, id]);
  };

  const isGameWon = matched.length === cards.length && cards.length > 0;

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-3xl font-bold text-black dark:text-white">Memory Game</h1>

      <div className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
        Moves: <span className="text-blue-600">{moves}</span>
      </div>

      {isGameWon && (
        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
          🎉 You Won in {moves} moves!
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {cards.map((card) => {
          const revealed = flipped.includes(card.id) || matched.includes(card.id);
          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              disabled={revealed || locked}
              className={`w-16 h-16 text-3xl font-bold rounded-lg transition-all duration-300 ${
                revealed
                  ? matched.includes(card.id)
                    ? "bg-green-500 dark:bg-green-600"
                    : "bg-blue-500 dark:bg-blue-600"
                  : "bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600"
              }`}
            >
              {revealed ? card.emoji : "?"}
            </button>
          );
        })}
      </div>

      <button
        onClick={initializeGame}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        New Game
      </button>
    </div>
  );
}