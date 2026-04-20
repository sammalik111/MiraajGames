"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ── Maze ───────────────────────────────────────────────────────────────────
const MAZE_RAW = [
  "###################",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#o##.###.#.###.##o#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.### # ###.####",
  "   #.#       #.#   ",
  "####.# ##=## #.####",
  "#......#   #......#",
  "####.# ##### #.####",
  "   #.#       #.#   ",
  "####.# ##### #.####",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#o.#.....P.....#.o#",
  "##.#.#.#####.#.#.##",
  "#....#...#...#....#",
  "#.######.#.######.#",
  "#.................#",
  "###################",
];

const ROWS = MAZE_RAW.length;
const COLS = MAZE_RAW[0].length;
const CELL = 20;

// ── Types ──────────────────────────────────────────────────────────────────
type Tile = "wall" | "dot" | "power" | "empty" | "door";
type Pos  = { r: number; c: number };
type Dir  = { dr: number; dc: number };

const DIRS = {
  Up:    { dr: -1, dc:  0 } as Dir,
  Down:  { dr:  1, dc:  0 } as Dir,
  Left:  { dr:  0, dc: -1 } as Dir,
  Right: { dr:  0, dc:  1 } as Dir,
  None:  { dr:  0, dc:  0 } as Dir,
};

// ── Level Config ───────────────────────────────────────────────────────────
interface LevelConfig { numGhosts: number; tickMs: number; scaredDuration: number; }
const LEVELS: LevelConfig[] = [
  { numGhosts: 2, tickMs: 140, scaredDuration: 30 },
  { numGhosts: 3, tickMs: 115, scaredDuration: 22 },
  { numGhosts: 4, tickMs:  95, scaredDuration: 15 },
];

const GHOST_COLORS = ["#ef4444", "#ec4899", "#22d3ee", "#f97316"];

// ── Maze helpers ───────────────────────────────────────────────────────────
function parseMaze(): { tiles: Tile[][]; pacStart: Pos; ghostStart: Pos } {
  const tiles: Tile[][] = [];
  let pacStart: Pos  = { r: 16, c: 9 };
  let ghostStart: Pos = { r:  8, c: 9 };
  for (let r = 0; r < ROWS; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < COLS; c++) {
      const ch = MAZE_RAW[r]?.[c] ?? " ";
      if      (ch === "#") row.push("wall");
      else if (ch === ".") row.push("dot");
      else if (ch === "o") row.push("power");
      else if (ch === "=") { row.push("door"); ghostStart = { r: r - 1, c }; }
      else if (ch === "P") { row.push("empty"); pacStart = { r, c }; }
      else                  row.push("empty");
    }
    tiles.push(row);
  }
  return { tiles, pacStart, ghostStart };
}

function canMove(tiles: Tile[][], r: number, c: number, allowDoor = false): boolean {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true; // tunnel
  const t = tiles[r][c];
  if (t === "wall")              return false;
  if (t === "door" && !allowDoor) return false;
  return true;
}

function wrapPos(pos: Pos): Pos {
  let { r, c } = pos;
  if (c < 0)    c = COLS - 1;
  if (c >= COLS) c = 0;
  return { r, c };
}

type Ghost = { pos: Pos; dir: Dir; color: string; scared: number };

function buildGhosts(ghostStart: Pos, numGhosts: number): Ghost[] {
  const positions: Pos[] = [
    { r: ghostStart.r,     c: ghostStart.c     },
    { r: ghostStart.r,     c: ghostStart.c + 1 },
    { r: ghostStart.r + 1, c: ghostStart.c     },
    { r: ghostStart.r + 1, c: ghostStart.c + 1 },
  ];
  const initDirs: Dir[] = [DIRS.Left, DIRS.Right, DIRS.Up, DIRS.Down];
  return Array.from({ length: numGhosts }, (_, i) => ({
    pos:   positions[i % positions.length],
    dir:   initDirs[i % 4],
    color: GHOST_COLORS[i],
    scared: 0,
  }));
}

// ── Ad Placeholder ─────────────────────────────────────────────────────────
function AdPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-slate-500 font-semibold tracking-widest uppercase">Advertisement</span>
      <div
        className="rounded border border-slate-600 bg-slate-800 flex items-center justify-center text-slate-500 text-sm font-medium"
        style={{ width: 300, height: 250 }}
      >
        300 × 250 Ad
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PacmanGame() {
  const mazeData = useRef(parseMaze());

  const [levelIdx,   setLevelIdx]   = useState(0);
  const [tiles,      setTiles]      = useState<Tile[][]>(() => mazeData.current.tiles.map(r => [...r]));
  const [pac,        setPac]        = useState<Pos>(mazeData.current.pacStart);
  const [pacDir,     setPacDir]     = useState<Dir>(DIRS.None);
  const [requested,  setRequested]  = useState<Dir>(DIRS.None);
  const [ghosts,     setGhosts]     = useState<Ghost[]>(() => buildGhosts(mazeData.current.ghostStart, LEVELS[0].numGhosts));
  const [score,      setScore]      = useState(0);
  const [lives,      setLives]      = useState(3);
  const [gamePhase,  setGamePhase]  = useState<"playing" | "levelClear" | "won" | "lost">("playing");

  // Refs for use inside setInterval closure
  const tilesRef    = useRef(tiles);
  const pacRef      = useRef(pac);
  const pacDirRef   = useRef(pacDir);
  const reqRef      = useRef(requested);
  const ghostsRef   = useRef(ghosts);
  const levelIdxRef = useRef(levelIdx);
  tilesRef.current    = tiles;
  pacRef.current      = pac;
  pacDirRef.current   = pacDir;
  reqRef.current      = requested;
  ghostsRef.current   = ghosts;
  levelIdxRef.current = levelIdx;

  // Keys
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowUp")    setRequested(DIRS.Up);
      if (e.key === "ArrowDown")  setRequested(DIRS.Down);
      if (e.key === "ArrowLeft")  setRequested(DIRS.Left);
      if (e.key === "ArrowRight") setRequested(DIRS.Right);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const respawn = useCallback(() => {
    const m = mazeData.current;
    setPac(m.pacStart);
    setPacDir(DIRS.None);
    setRequested(DIRS.None);
    setGhosts(buildGhosts(m.ghostStart, LEVELS[levelIdxRef.current].numGhosts));
  }, []);

  const resetFull = useCallback(() => {
    const m = parseMaze();
    mazeData.current = m;
    setLevelIdx(0);
    setTiles(m.tiles.map(r => [...r]));
    setPac(m.pacStart);
    setPacDir(DIRS.None);
    setRequested(DIRS.None);
    setGhosts(buildGhosts(m.ghostStart, LEVELS[0].numGhosts));
    setScore(0);
    setLives(3);
    setGamePhase("playing");
  }, []);

  // Game tick — restarts whenever phase or level changes
  useEffect(() => {
    if (gamePhase !== "playing") return;
    const cfg = LEVELS[levelIdx];

    const id = window.setInterval(() => {
      const t0  = tilesRef.current;
      let p     = pacRef.current;
      let dir   = pacDirRef.current;
      const req = reqRef.current;

      // Try queued direction first
      if (req.dr !== 0 || req.dc !== 0) {
        const np = wrapPos({ r: p.r + req.dr, c: p.c + req.dc });
        if (canMove(t0, np.r, np.c)) dir = req;
      }
      // Move in current direction
      const next = wrapPos({ r: p.r + dir.dr, c: p.c + dir.dc });
      if (canMove(t0, next.r, next.c)) { p = next; }
      else { dir = DIRS.None; }

      // Eat dot / power pellet
      let scoreGain = 0;
      let poweredUp = false;
      const tile = t0[p.r]?.[p.c];
      if (tile === "dot" || tile === "power") {
        const copy = t0.map(row => [...row]);
        copy[p.r][p.c] = "empty";
        tilesRef.current = copy;
        setTiles(copy);
        scoreGain = tile === "power" ? 50 : 10;
        if (tile === "power") poweredUp = true;
      }
      if (scoreGain) setScore(s => s + scoreGain);

      // Move ghosts
      const newGhosts = ghostsRef.current.map(g => {
        const candidates: Dir[] = [];
        for (const d of [DIRS.Up, DIRS.Down, DIRS.Left, DIRS.Right]) {
          if (d.dr === -g.dir.dr && d.dc === -g.dir.dc) continue; // no U-turn
          const np = wrapPos({ r: g.pos.r + d.dr, c: g.pos.c + d.dc });
          if (canMove(t0, np.r, np.c, true)) candidates.push(d);
        }
        const toward = g.scared > 0 ? -1 : 1;
        let chosen = candidates[0] || g.dir;
        let best = -Infinity;
        for (const d of candidates) {
          const np = wrapPos({ r: g.pos.r + d.dr, c: g.pos.c + d.dc });
          const dist = Math.abs(np.r - p.r) + Math.abs(np.c - p.c);
          const sc   = -dist * toward + Math.random() * 1.5;
          if (sc > best) { best = sc; chosen = d; }
        }
        const newPos = wrapPos({ r: g.pos.r + chosen.dr, c: g.pos.c + chosen.dc });
        return {
          ...g,
          pos:    newPos,
          dir:    chosen,
          scared: poweredUp ? cfg.scaredDuration : Math.max(0, g.scared - 1),
        };
      });
      ghostsRef.current = newGhosts;

      // Ghost–pac collisions
      let remaining = newGhosts;
      let died = false;
      for (const g of newGhosts) {
        if (g.pos.r === p.r && g.pos.c === p.c) {
          if (g.scared > 0) {
            setScore(s => s + 200);
            const home = mazeData.current.ghostStart;
            remaining = remaining.map(og =>
              og === g ? { ...og, pos: { r: home.r, c: home.c }, scared: 0 } : og
            );
          } else {
            died = true;
          }
        }
      }

      if (died) {
        setLives(l => {
          const nl = l - 1;
          if (nl <= 0) setGamePhase("lost");
          else respawn();
          return Math.max(0, nl);
        });
        return;
      }

      setGhosts(remaining);
      setPac(p);
      setPacDir(dir);

      // Level complete?
      const anyLeft = tilesRef.current.some(row => row.some(c => c === "dot" || c === "power"));
      if (!anyLeft) {
        const nextIdx = levelIdxRef.current + 1;
        if (nextIdx >= LEVELS.length) {
          setGamePhase("won");
        } else {
          setGamePhase("levelClear");
          setTimeout(() => {
            const m = parseMaze();
            mazeData.current = m;
            setLevelIdx(nextIdx);
            setTiles(m.tiles.map(r => [...r]));
            setPac(m.pacStart);
            setPacDir(DIRS.None);
            setRequested(DIRS.None);
            setGhosts(buildGhosts(m.ghostStart, LEVELS[nextIdx].numGhosts));
            setGamePhase("playing");
          }, 1800);
        }
      }
    }, cfg.tickMs);

    return () => window.clearInterval(id);
  }, [gamePhase, levelIdx, respawn]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 text-white py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Pac-Man</h1>
            <p className="text-slate-400 text-sm">Eat all dots to advance</p>
          </div>
          <div className="bg-slate-700 rounded-xl px-5 py-2 text-center">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Level</div>
            <div className="text-2xl font-bold text-yellow-400">{levelIdx + 1} / {LEVELS.length}</div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800 rounded-lg px-4 py-2 mb-4 text-sm text-slate-300">
          Arrow keys to move · Eat all dots · Power pellets (large yellow) scare ghosts · Eat scared ghosts for +200
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Game */}
          <div className="flex-1">
            {/* Stats */}
            <div className="flex gap-4 mb-3">
              <div className="bg-slate-800 rounded-lg px-4 py-2 flex-1 text-center">
                <div className="text-xs text-slate-400 uppercase tracking-widest">Score</div>
                <div className="text-xl font-bold text-yellow-400">{score}</div>
              </div>
              <div className="bg-slate-800 rounded-lg px-4 py-2 flex-1 text-center">
                <div className="text-xs text-slate-400 uppercase tracking-widest">Lives</div>
                <div className="text-xl font-bold text-red-400">
                  {"♥".repeat(lives)}{"♡".repeat(Math.max(0, 3 - lives))}
                </div>
              </div>
            </div>

            {/* Maze */}
            <div className="relative inline-block">
              <div
                className="relative rounded-lg border-2 border-blue-900 bg-black overflow-hidden"
                style={{ width: COLS * CELL, height: ROWS * CELL }}
              >
                {/* Tiles */}
                {tiles.map((row, r) =>
                  row.map((t, c) => (
                    <div
                      key={`${r}-${c}`}
                      className="absolute"
                      style={{
                        left: c * CELL, top: r * CELL, width: CELL, height: CELL,
                        background:
                          t === "wall" ? "#1e3a8a" :
                          t === "door" ? "#f472b6" :
                          "black",
                      }}
                    >
                      {t === "wall" && (
                        <div className="absolute inset-0 opacity-30"
                          style={{ borderTop: "2px solid #3b82f6", borderLeft: "2px solid #3b82f6" }} />
                      )}
                      {t === "dot" && (
                        <div className="absolute rounded-full bg-yellow-100"
                          style={{ left: CELL/2 - 2, top: CELL/2 - 2, width: 4, height: 4 }} />
                      )}
                      {t === "power" && (
                        <div className="absolute rounded-full bg-yellow-300 animate-pulse"
                          style={{ left: CELL/2 - 5, top: CELL/2 - 5, width: 10, height: 10 }} />
                      )}
                    </div>
                  ))
                )}

                {/* Ghosts */}
                {ghosts.map((g, i) => (
                  <div
                    key={i}
                    className="absolute transition-all duration-100"
                    style={{ left: g.pos.c * CELL + 1, top: g.pos.r * CELL + 1, width: CELL - 2, height: CELL - 2 }}
                  >
                    <div className="absolute inset-0 rounded-t-full"
                      style={{ background: g.scared > 0 ? "#60a5fa" : g.color }} />
                    {g.scared === 0 && (
                      <>
                        <div className="absolute bg-white rounded-full" style={{ left: 3, top: 4, width: 5, height: 5 }}>
                          <div className="absolute bg-blue-800 rounded-full" style={{ left: 1, top: 1, width: 3, height: 3 }} />
                        </div>
                        <div className="absolute bg-white rounded-full" style={{ right: 3, top: 4, width: 5, height: 5 }}>
                          <div className="absolute bg-blue-800 rounded-full" style={{ left: 1, top: 1, width: 3, height: 3 }} />
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {/* Pac-Man */}
                <div
                  className="absolute rounded-full bg-yellow-300 transition-all duration-100"
                  style={{ left: pac.c * CELL + 2, top: pac.r * CELL + 2, width: CELL - 4, height: CELL - 4 }}
                />

                {/* Overlays */}
                {gamePhase === "levelClear" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 rounded-lg">
                    <div className="text-2xl font-black text-yellow-400">Level {levelIdx + 1} Complete!</div>
                    <div className="text-slate-300 text-sm mt-1">Loading next level…</div>
                  </div>
                )}
                {gamePhase === "won" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-lg">
                    <div className="text-3xl font-black text-green-400 mb-2">You Win! 🏆</div>
                    <div className="text-slate-300 mb-4">Final Score: {score}</div>
                    <button className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold" onClick={resetFull}>
                      Play Again
                    </button>
                  </div>
                )}
                {gamePhase === "lost" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-lg">
                    <div className="text-3xl font-black text-red-400 mb-2">Game Over</div>
                    <div className="text-slate-300 mb-4">Score: {score}</div>
                    <button className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold" onClick={resetFull}>
                      Play Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="flex-shrink-0 flex flex-col gap-4 items-start">
            <AdPlaceholder />
            <div className="bg-slate-800 rounded-lg p-4 w-full">
              <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wide">Levels</h3>
              {LEVELS.map((lv, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between py-1 text-sm border-b border-slate-700 last:border-0 ${
                    i === levelIdx ? "text-yellow-400 font-bold" : "text-slate-500"
                  }`}
                >
                  <span>Level {i + 1}</span>
                  <span className="text-xs">{lv.numGhosts} ghosts</span>
                  {i < levelIdx && <span className="text-green-400">✓</span>}
                  {i === levelIdx && (
                    <span className="text-xs bg-yellow-400 text-slate-900 px-1 rounded">now</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
