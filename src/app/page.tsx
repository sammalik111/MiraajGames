import GameCard from "@/components/gameCard";
import HudPanel from "@/components/HudPanel";
import { games } from "@/data/gameData";
import Navbar from "@/components/navbar";
import { db, users } from "@/db";


const usercount = await db.select()
  .from(users)
  .then(rows => rows.length)
  .catch(err => {
    console.error("Error fetching user count:", err);
    return "N/A";
});

export default function Home() {
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
              <span className="hud-chip">
                v2.0.4 · nightly
              </span>
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
                href="#games"
                className="font-mono text-xs uppercase tracking-[0.2em] px-5 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
              >
                Enter Arcade →
              </a>
              <a
                href="/auth/signin"
                className="font-mono text-xs uppercase tracking-[0.2em] px-5 py-3 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:ring-magenta transition"
              >
                Authenticate
              </a>
            </div>

            {/* Quick stat rail */}
            <dl className="grid grid-cols-3 gap-3 pt-4 border-t border-[color:var(--border)]">
              {[
                { label: "Cabinets", value: games.length.toString().padStart(2, "0"), accent: "cyan" },
                { label: "Uptime", value: "99.9%", accent: "magenta" },
                { label: "Players", value: usercount, accent: "yellow" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                    {stat.label}
                  </dt>
                  <dd className={`font-display font-bold text-2xl mt-1 text-${stat.accent} dark:glow-${stat.accent}`}>
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Featured panel — HUD style */}
          <HudPanel accent="magenta" innerClassName="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                  &gt; Featured Cabinet
                </p>
                <h2 className="font-display font-bold text-2xl mt-2 text-[color:var(--fg)]">
                  Mario Platformer
                </h2>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">Status</p>
                <p className="font-mono text-sm text-[color:var(--neon-cyan)] dark:glow-cyan mt-1">
                  <span className="blink">●</span> LIVE
                </p>
              </div>
            </div>

            {/* Terminal readout */}
            <div className="border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4 font-term text-xl leading-6 text-[color:var(--neon-lime)] scanline-overlay">
              &gt; Loading level 1-1...<br />
              &gt; Physics engine: ready<br />
              &gt; Controls: mapped<br />
              &gt; Ready<span className="blink">_</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { k: "Genre", v: "Platformer" },
                { k: "Difficulty", v: "Casual" },
                { k: "Co-op", v: "Solo" },
                { k: "Input", v: "Keyboard" },
              ].map((item) => (
                <div key={item.k} className="border-l-2 border-[color:var(--neon-cyan)] pl-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
                    {item.k}
                  </p>
                  <p className="text-sm text-[color:var(--fg)]">{item.v}</p>
                </div>
              ))}
            </div>
          </HudPanel>
        </section>

        {/* Library */}
        <section id="games" className="mt-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-[color:var(--border)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                ┌─ Section 02
              </p>
              <h2 className="font-display font-bold text-3xl mt-2 text-[color:var(--fg)]">
                Game Library
              </h2>
              <p className="max-w-2xl text-[color:var(--fg-muted)] mt-1">
                {games.length} playable cabinets. Sorted by cabinet ID.
              </p>
            </div>
            <span className="hud-chip">
              <span className="text-[color:var(--neon-cyan)] blink">●</span>
              {games.length} available
            </span>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {games.map((game) => (
              <GameCard
                key={game.id}
                id={game.id}
                title={game.title}
                description={game.description}
                creator={game.creator}
                theme={game.theme}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
