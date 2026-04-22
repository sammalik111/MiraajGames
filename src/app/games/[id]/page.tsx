import Navbar from "@/components/navbar";
import { games } from "@/data/gameData";
import TicTacToe from "@/components/games/TicTacToe";
import MemoryGame from "@/components/games/MemoryGame";
import PlatformerGame from "@/components/games/PlatformerGame";
import PoolGame from "@/components/games/PoolGame";
import ShooterGame from "@/components/games/ShooterGame";
import ChessGame from "@/components/games/ChessGame";
import SpaceInvadersGame from "@/components/games/SpaceInvadersGame";
import PacmanGame from "@/components/games/PacmanGame";
import TetrisGame from "@/components/games/TetrisGame";
import CrosswordGame from "@/components/games/CrosswordGame";
import MinesweeperGame from "@/components/games/MinesweeperGame";
import SodukuGame from "@/components/games/sodukuGame";
import BattleshipGame from "@/components/games/battleshipGame";
import Link from "next/link";

export function generateStaticParams() {
  return games.map((game) => ({
    id: game.id.toString(),
  }));
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = games.find((g) => g.id === parseInt(id, 10));

  if (!game) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Navbar />
        <div className="flex min-h-[70vh] items-center justify-center px-4 text-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-2xl shadow-slate-300/40 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/30">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Game Not Found</h1>
            <p className="mt-4 text-slate-500 dark:text-slate-400">This game does not exist yet. Head back to the library to explore other demos.</p>
            <Link
              href="/"
              className="mt-8 inline-flex rounded-full bg-violet-500 px-6 py-3 text-white transition hover:bg-violet-400"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const renderGame = () => {
    switch (game.id) {
      case 1:
        return <PlatformerGame />;
      case 2:
        return <PoolGame />;
      case 3:
        return <ShooterGame />;
      case 4:
        return <ChessGame />;
      case 5:
        return <TicTacToe />;
      case 6:
        return <MemoryGame />;
      case 7:
        return <SpaceInvadersGame />;
      case 8:
        return <PacmanGame />;
      case 9:
        return <TetrisGame />;
      case 10:
        return <CrosswordGame />;
      case 11:
        return <BattleshipGame />;
      case 12:
        return <MinesweeperGame />;
      case 13:
        return <SodukuGame />;
      default:
        return <div className="text-center text-slate-400">Game coming soon...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-300/40 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/20">
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center rounded-full bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-700 ring-1 ring-violet-500/30 dark:text-violet-200 dark:ring-violet-500/20">
                {game.theme.toUpperCase()}
              </div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{game.title}</h1>
              <p className="max-w-3xl text-slate-600 dark:text-slate-300">{game.description}</p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
                <span>Creator: {game.creator}</span>
                <span>Game ID: {game.id}</span>
              </div>
            </div>

            <div className="rounded-[2rem] bg-slate-100 p-6 shadow-inner shadow-slate-200/60 dark:bg-slate-950/80 dark:shadow-slate-950/40">
              {renderGame()}
            </div>
          </section>

          <aside className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-300/40 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/20">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Game Details</h2>
              <p className="text-slate-500 dark:text-slate-400">This page loads the selected demo and keeps your favorite games synced when you are logged in.</p>
            </div>

            <div className="rounded-3xl bg-slate-100 p-5 text-slate-700 shadow-inner shadow-slate-200/60 dark:bg-slate-950/90 dark:text-slate-300 dark:shadow-slate-950/30">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">How to play</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                <li>• Launch the game and interact directly inside the canvas.</li>
                <li>• Add favorites from the homepage to save your picks.</li>
                <li>• Sign in to sync favorites with your account.</li>
              </ul>
            </div>

            <Link
              href="/"
              className="inline-flex w-full justify-center rounded-full bg-violet-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
            >
              Back to Library
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
