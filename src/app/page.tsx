import GameCard from "@/components/gameCard";
import { games } from "@/data/gameData";
import Navbar from "@/components/navbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-10 md:grid-cols-[1.4fr_1fr] items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-700 ring-1 ring-violet-500/30 dark:text-violet-100 dark:ring-violet-400/20">
              New design · curated library · interactive demos
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Miraaj Games
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                A modern gaming hub built with Next.js. Discover mini-games, save favorites, and launch interactive demos instantly.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#games"
                className="inline-flex items-center justify-center rounded-full bg-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-400"
              >
                Browse Games
              </a>
              <a
                href="/auth/signin"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:border-slate-500"
              >
                Sign In
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-300/40 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/40">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Featured game</p>
                  <h2 className="text-3xl font-bold">Mario Platformer</h2>
                </div>
                <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  10 games
                </div>
              </div>
              <div className="grid gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-violet-100 to-slate-50 p-6 text-slate-700 dark:border-slate-800 dark:from-violet-950/90 dark:to-slate-900/80 dark:text-slate-300">
                <div className="rounded-3xl bg-white/90 p-5 shadow-inner shadow-slate-200/60 dark:bg-slate-950/90 dark:shadow-slate-900/30">
                  <p className="text-sm text-slate-500">Platformer with classic vibes and responsive controls.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-white/90 p-4 text-sm text-slate-700 dark:bg-slate-950/90 dark:text-slate-300">Explore dynamic levels</div>
                  <div className="rounded-3xl bg-white/90 p-4 text-sm text-slate-700 dark:bg-slate-950/90 dark:text-slate-300">Save favorites automatically</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="games" className="mt-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold">Game Collection</h2>
              <p className="max-w-2xl text-slate-500 dark:text-slate-400">Tap into a growing collection of demo experiences, from strategy to arcade and classic sports.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-700 ring-1 ring-slate-300 dark:bg-slate-900/80 dark:text-slate-300 dark:ring-slate-700">
              {games.length} games available
            </div>
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
