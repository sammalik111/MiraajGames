"use client";

import React, { useState } from "react";

export default function TicTacToe() {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [gameOver, setGameOver] = useState(false);

  const calculateWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  };

  const winner = calculateWinner(board);
  const isBoardFull = board.every((square) => square !== null);

  const handleClick = (index: number) => {
    if (board[index] || winner || gameOver) return;

    const newBoard = [...board];
    newBoard[index] = isXNext ? "X" : "O";
    setBoard(newBoard);
    setIsXNext(!isXNext);

    if (calculateWinner(newBoard)) {
      setGameOver(true);
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setGameOver(false);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-3xl font-bold text-black dark:text-white">Tic Tac Toe</h1>

      <div className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
        {winner ? (
          <span className="text-green-600 dark:text-green-400">🎉 Player {winner} Wins!</span>
        ) : isBoardFull ? (
          <span className="text-yellow-600 dark:text-yellow-400">It's a Draw!</span>
        ) : (
          <span>Current Player: <span className="text-blue-600">{isXNext ? "X" : "O"}</span></span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 bg-zinc-200 dark:bg-zinc-700 p-2 rounded-lg">
        {board.map((value, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            className="w-20 h-20 bg-white dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-600 text-3xl font-bold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            {value === "X" ? (
              <span className="text-blue-600">X</span>
            ) : value === "O" ? (
              <span className="text-red-600">O</span>
            ) : null}
          </button>
        ))}
      </div>

      <button
        onClick={resetGame}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        Reset Game
      </button>
    </div>
  );
}
