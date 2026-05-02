"use client";

import { ReactNode } from "react";
import GameShell from "./GameShell";
import TicTacToe from "./TicTacToe";
import MemoryGame from "./MemoryGame";
import PlatformerGame from "./PlatformerGame";
import PoolGame from "./PoolGame";
import ShooterGame from "./ShooterGame";
import ChessGame from "./ChessGame";
import SpaceInvadersGame from "./SpaceInvadersGame";
import PacmanGame from "./PacmanGame";
import TetrisGame from "./TetrisGame";
import CrosswordGame from "./CrosswordGame";
import MinesweeperGame from "./MinesweeperGame";
import SodukuGame from "./sodukuGame";
import BattleshipGame from "./battleshipGame";
import FlappyBirdGame from "./FlappyBirdGame";
import CrossyRoadGame from "./CrossyRoadGame";

interface Props {
  gameId: number;
}

// Tiny helper so each case is one line. Renders the game inside GameShell,
// passing onGameEnd + a runKey to remount cleanly on retry.
function shell(
  gameId: number,
  render: (api: {
    onGameEnd: (score: number, metadata?: Record<string, unknown>) => void;
    runKey: number;
  }) => ReactNode,
) {
  return <GameShell gameId={gameId}>{render}</GameShell>;
}

// Single client entry point. Every game now goes through GameShell so it
// gets score submission + the post-run leaderboard panel for free.
export default function GameRunner({ gameId }: Props) {
  switch (gameId) {
    case 1:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <PlatformerGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 2:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <PoolGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 3:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <ShooterGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 4:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <ChessGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 5:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <TicTacToe key={runKey} onGameEnd={onGameEnd} />
      ));
    case 6:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <MemoryGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 7:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <SpaceInvadersGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 8:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <PacmanGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 9:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <TetrisGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 10:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <CrosswordGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 11:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <BattleshipGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 12:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <MinesweeperGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 13:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <SodukuGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 14:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <FlappyBirdGame key={runKey} onGameEnd={onGameEnd} />
      ));
    case 15:
      return shell(gameId, ({ onGameEnd, runKey }) => (
        <CrossyRoadGame key={runKey} onGameEnd={onGameEnd} />
      ));
    default:
      return (
        <p className="text-center font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
          &gt; Cabinet build pending...
        </p>
      );
  }
}
