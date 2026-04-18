"use client";

import React, { useState, useEffect } from "react";

const EMOJIS = ["🎮", "🎯", "🎲", "🎪", "🎨", "🎭"];

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export default function MemoryGame() {
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const shuffled = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: index,
        emoji,
        isFlipped: false,
        isMatched: false,
      }));
    setCards(shuffled);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
  };

  const handleCardClick = (id: number) => {
    if (flipped.includes(id) || matched.includes(id)) return;

    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(moves + 1);
      const [first, second] = newFlipped;

      if (cards[first].emoji === cards[second].emoji) {
        setMatched([...matched, first, second]);
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 1000);
      }
    }
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
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            className={`w-16 h-16 text-3xl font-bold rounded-lg transition-all duration-300 ${
              flipped.includes(card.id) || matched.includes(card.id)
                ? "bg-blue-500 dark:bg-blue-600"
                : "bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600"
            }`}
          >
            {flipped.includes(card.id) || matched.includes(card.id)
              ? card.emoji
              : "?"}
          </button>
        ))}
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
