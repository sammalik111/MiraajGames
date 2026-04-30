"use client";

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

// Single client entry point for rendering a game by id. Games that have been
// migrated to the leaderboard contract (accept `onGameEnd`) are wrapped in
// GameShell so they get score submission + the post-run leaderboard panel.
// Unmigrated games render plain — they'll get wrapped as they're updated to
// the new contract.
export default function GameRunner({ gameId }: Props) {
  switch (gameId) {
    // --- Migrated to leaderboard contract ---
    case 14:
      return (
        <GameShell gameId={gameId}>
          {({ onGameEnd, runKey }) => (
            <FlappyBirdGame key={runKey} onGameEnd={onGameEnd} />
          )}
        </GameShell>
      );

    // --- Not yet migrated (no leaderboard yet) ---
    case 1: return <PlatformerGame />;
    case 2: return <PoolGame />;
    case 3: return <ShooterGame />;
    case 4: return <ChessGame />;
    case 5: return <TicTacToe />;
    case 6: return <MemoryGame />;
    case 7: return <SpaceInvadersGame />;
    case 8: return <PacmanGame />;
    case 9: return <TetrisGame />;
    case 10: return <CrosswordGame />;
    case 11: return <BattleshipGame />;
    case 12: return <MinesweeperGame />;
    case 13: return <SodukuGame />;
    case 15: return <CrossyRoadGame />;
    default:
      return (
        <p className="text-center font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
          &gt; Cabinet build pending...
        </p>
      );
  }
}
