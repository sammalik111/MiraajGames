import GameCard from "@/components/gameCard";
import HudPanel from "@/components/HudPanel";
import { games } from "@/data/gameData";
import Navbar from "@/components/navbar";
import { db, users } from "@/db";
import FeaturedCabinet from "@/components/FeaturedCabinet";
import LibraryNav from "@/components/LibraryNav";

const usercount = await db
  .select()
  .from(users)
  .then((rows) => rows.length)
  .catch((err) => {
    console.error("Error fetching user count:", err);
    return "N/A";
  });

export default function Home() {
  const singlePlayerGames = games.filter((u) => u.grouping == "singleplayer");
  const multiPlayerGames = games.filter((u) => u.grouping == "multiplayer");

  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="grid gap-10 md:grid-cols-[1.3fr_1fr] items-center">
          <div className="space-y-7">
            <div className="flex flex-wrap gap-2">
              <span className="hud-chip">
                <span className="text-[color:var(--neon-cyan)]">●</span> Link Established
              </span>
              <span className="hud-chip">v2.0.4 · nightly</span>
            </div>

            <div className="space-y-4">
              <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight">
                <span className="text-[color:var(--fg)]">MIRAAJ</span>
                <span className="text-[color:var(--neon-magenta)] dark:glow-magenta">//</span>
                <span className="text-[color:var(--neon-cyan)] dark:glow-cyan">GAMES</span>
              </h1>
              <p className="max-w-xl text-lg leading-8 text-[color:var(--fg-muted)]">
                A curated arcade of mini-games with a cyberpunk paint job. Browse the library,
                save your favorites, and drop in — no downloads.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="#singleplayer"
                className="font-mono text-xs uppercase tracking-[0.2em] px-5 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
              >
                Enter Arcade →
              </a>
              <a
                href="#multiplayer"
                className="font-mono text-xs uppercase tracking-[0.2em] px-5 py-3 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:ring-magenta transition"
              >
                Find a Match
              </a>
            </div>

            {/* Quick stat rail */}
            <dl className="grid grid-cols-3 gap-3 pt-4 border-t border-[color:var(--border)]">
              {[
                { label: "Cabinets", value: games.length.toString().padStart(2, "0"), accent: "cyan" },
                { label: "Multiplayer", value: multiPlayerGames.length.toString().padStart(2, "0"), accent: "magenta" },
                { label: "Players", value: usercount, accent: "yellow" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                    {stat.label}
                  </dt>
                  <dd
                    className={`font-display font-bold text-2xl mt-1 text-${stat.accent} dark:glow-${stat.accent}`}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Featured cabinet — auto-rotates through games every 6s.
              Clickable to navigate to the highlighted cabinet. */}
          <FeaturedCabinet games={games} />
        </section>

        {/* Library — sticky anchor nav + two ID'd sections (Single Player,
            Multi Player). Anchor links jump-scroll to each section. */}
        <section id="library" className="mt-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-[color:var(--border)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                ┌─ Section 02
              </p>
              <h2 className="font-display font-bold text-3xl mt-2 text-[color:var(--fg)]">
                Game Library
              </h2>
              <p className="max-w-2xl text-[color:var(--fg-muted)] mt-1">
                {games.length} playable cabinets across {singlePlayerGames.length}{" "}
                singleplayer and {multiPlayerGames.length} multiplayer modes.
              </p>
            </div>
            <span className="hud-chip">
              <span className="text-[color:var(--neon-cyan)] blink">●</span>
              {games.length} available
            </span>
          </div>

          {/* Sticky jump nav for the library — Single Player / Multi
              Player. Mirrors the profile page's pattern: all sections
              eagerly rendered, this is purely navigational. */}
          <LibraryNav
            sections={[
              { id: "singleplayer", label: "Single Player", count: singlePlayerGames.length },
              { id: "multiplayer", label: "Multiplayer", count: multiPlayerGames.length },
            ]}
          />

          <section id="singleplayer" className="scroll-mt-20 mt-8">
            <div className="flex items-baseline justify-between mb-6">
              <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[color:var(--neon-cyan)]">
                ▸ Single Player
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                {singlePlayerGames.length} cabinets
              </span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {singlePlayerGames.map((game) => (
                <GameCard
                  key={game.id}
                  id={game.id}
                  title={game.title}
                  description={game.description}
                  creator={game.creator}
                  theme={game.theme}
                  grouping={game.grouping}
                />
              ))}
            </div>
          </section>

          <section id="multiplayer" className="scroll-mt-20 mt-12">
            <div className="flex items-baseline justify-between mb-6">
              <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[color:var(--neon-magenta)]">
                ▸ Multiplayer
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                {multiPlayerGames.length} cabinets · live rooms
              </span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {multiPlayerGames.map((game) => (
                <GameCard
                  key={game.id}
                  id={game.id}
                  title={game.title}
                  description={game.description}
                  creator={game.creator}
                  theme={game.theme}
                  grouping={game.grouping}
                />
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

// HudPanel is imported indirectly via FeaturedCabinet, but TS still
// needs the import in this file when other hero variants are tried.
// Keep the import live to avoid a delete-and-re-add cycle.
void HudPanel;
