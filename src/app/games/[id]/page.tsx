import Navbar from "@/components/navbar";
import HudPanel from "@/components/HudPanel";
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
      <div className="min-h-screen text-[color:var(--fg)]">
        <Navbar />
        <main className="relative z-10 mx-auto max-w-3xl px-4 py-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
            ✕ Signal lost
          </p>
          <h1 className="mt-3 font-display font-black text-4xl sm:text-5xl tracking-tight">
            CABINET <span className="text-[color:var(--neon-magenta)] dark:glow-magenta">404</span>
          </h1>
          <p className="mt-4 text-[color:var(--fg-muted)]">
            This cabinet is offline or was never installed. Return to the arcade floor.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex font-mono text-xs uppercase tracking-[0.2em] px-5 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
          >
            ← Back to Arcade
          </Link>
        </main>
      </div>
    );
  }

  const renderGame = () => {
    switch (game.id) {
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
      default:
        return (
          <p className="text-center font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            &gt; Cabinet build pending...
          </p>
        );
    }
  };

  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Crumb */}
        <Link
          href="/#games"
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-cyan)] transition"
        >
          ← Back to Library
        </Link>

        <div className="mt-6 grid gap-8 xl:grid-cols-[1.3fr_0.9fr]">
          {/* Cabinet */}
          <section>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="hud-chip">
                <span className="text-[color:var(--neon-cyan)]">●</span> cab#{String(game.id).padStart(2, "0")}
              </span>
              <span className="hud-chip">
                ▸ {game.theme}
              </span>
              <span className="hud-chip">
                <span className="blink text-[color:var(--neon-lime)]">●</span> live
              </span>
            </div>

            <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight text-[color:var(--fg)] leading-[1]">
              {game.title}
            </h1>
            <p className="mt-3 max-w-2xl text-[color:var(--fg-muted)] leading-7">
              {game.description}
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
              Author :: <span className="text-[color:var(--neon-cyan)] dark:glow-cyan normal-case tracking-normal">{game.creator}</span>
            </p>

            {/* Cabinet screen */}
            <HudPanel className="mt-6" innerClassName="p-5 sm:p-6 bg-[color:var(--surface-2)]">
              <div className="scanline-overlay">
                {renderGame()}
              </div>
            </HudPanel>
          </section>

          {/* Sidebar */}
          <aside className="space-y-6">
            <HudPanel accent="magenta" innerClassName="p-6 space-y-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                  &gt; Cabinet Details
                </p>
                <h2 className="font-display font-bold text-2xl mt-2 text-[color:var(--fg)]">
                  Meta
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: "Theme", v: game.theme },
                  { k: "Cabinet", v: `#${String(game.id).padStart(2, "0")}` },
                  { k: "Author", v: game.creator },
                  { k: "Status", v: "Online" },
                ].map((item) => (
                  <div key={item.k} className="border-l-2 border-[color:var(--neon-cyan)] pl-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
                      {item.k}
                    </p>
                    <p className="text-sm text-[color:var(--fg)] mt-0.5">{item.v}</p>
                  </div>
                ))}
              </div>
            </HudPanel>

            <HudPanel innerClassName="p-6 space-y-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                  &gt; How to Play
                </p>
                <h3 className="font-display font-bold text-lg mt-2 text-[color:var(--fg)]">
                  Quick Brief
                </h3>
              </div>
              <ul className="space-y-2 text-sm leading-6 text-[color:var(--fg-muted)]">
                <li className="flex gap-2">
                  <span className="text-[color:var(--neon-cyan)]">▸</span>
                  Interact directly with the cabinet surface above.
                </li>
                <li className="flex gap-2">
                  <span className="text-[color:var(--neon-cyan)]">▸</span>
                  Tag ☆ from the library to save cabinets to your cache.
                </li>
                <li className="flex gap-2">
                  <span className="text-[color:var(--neon-cyan)]">▸</span>
                  Authenticate to sync favorites across sessions.
                </li>
              </ul>
            </HudPanel>

            <Link
              href="/#games"
              className="block w-full text-center font-mono text-xs uppercase tracking-[0.2em] px-5 py-3 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:ring-cyan transition"
            >
              ← Return to Library
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
