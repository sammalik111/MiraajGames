"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

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
const CELL = 18;

type Tile = "wall" | "dot" | "power" | "empty" | "door";
type Pos = { r: number; c: number };
type Dir = { dr: number; dc: number };

const DIRS: Record<string, Dir> = {
  Up: { dr: -1, dc: 0 },
  Down: { dr: 1, dc: 0 },
  Left: { dr: 0, dc: -1 },
  Right: { dr: 0, dc: 1 },
  None: { dr: 0, dc: 0 },
};

function parseMaze(): { tiles: Tile[][]; pacStart: Pos; ghostStart: Pos } {
  const tiles: Tile[][] = [];
  let pacStart: Pos = { r: 1, c: 1 };
  let ghostStart: Pos = { r: 9, c: 9 };
  for (let r = 0; r < ROWS; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < COLS; c++) {
      const ch = MAZE_RAW[r][c];
      if (ch === "#") row.push("wall");
      else if (ch === ".") row.push("dot");
      else if (ch === "o") row.push("power");
      else if (ch === "=") { row.push("door"); ghostStart = { r: r - 1, c }; }
      else if (ch === "P") { row.push("empty"); pacStart = { r, c }; }
      else row.push("empty");
    }
    tiles.push(row);
  }
  return { tiles, pacStart, ghostStart };
}

function canMove(tiles: Tile[][], r: number, c: number, allowDoor = false): boolean {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true; // tunnel
  const t = tiles[r][c];
  if (t === "wall") return false;
  if (t === "door" && !allowDoor) return false;
  return true;
}

function wrap(pos: Pos): Pos {
  let { r, c } = pos;
  if (c < 0) c = COLS - 1;
  if (c >= COLS) c = 0;
  return { r, c };
}

type Ghost = { pos: Pos; dir: Dir; color: string; scared: number };

export default function PacmanGame() {
  const initial = useRef(parseMaze());
  const [tiles, setTiles] = useState<Tile[][]>(initial.current.tiles.map((r) => [...r]));
  const [pac, setPac] = useState<Pos>(initial.current.pacStart);
  const [pacDir, setPacDir] = useState<Dir>(DIRS.None);
  const [requested, setRequested] = useState<Dir>(DIRS.None);
  const [ghosts, setGhosts] = useState<Ghost[]>([
    { pos: { r: initial.current.ghostStart.r, c: initial.current.ghostStart.c }, dir: DIRS.Left, color: "#ef4444", scared: 0 },
    { pos: { r: initial.current.ghostStart.r, c: initial.current.ghostStart.c + 1 }, dir: DIRS.Right, color: "#ec4899", scared: 0 },
    { pos: { r: initial.current.ghostStart.r + 1, c: initial.current.ghostStart.c }, dir: DIRS.Up, color: "#22d3ee", scared: 0 },
  ]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

  const tilesRef = useRef(tiles);
  const pacRef = useRef(pac);
  const pacDirRef = useRef(pacDir);
  const reqRef = useRef(requested);
  const ghostsRef = useRef(ghosts);
  tilesRef.current = tiles;
  pacRef.current = pac;
  pacDirRef.current = pacDir;
  reqRef.current = requested;
  ghostsRef.current = ghosts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowUp") setRequested(DIRS.Up);
      if (e.key === "ArrowDown") setRequested(DIRS.Down);
      if (e.key === "ArrowLeft") setRequested(DIRS.Left);
      if (e.key === "ArrowRight") setRequested(DIRS.Right);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const reset = useCallback(() => {
    const m = parseMaze();
    setTiles(m.tiles.map((r) => [...r]));
    setPac(m.pacStart);
    setPacDir(DIRS.None);
    setRequested(DIRS.None);
    setGhosts([
      { pos: { r: m.ghostStart.r, c: m.ghostStart.c }, dir: DIRS.Left, color: "#ef4444", scared: 0 },
      { pos: { r: m.ghostStart.r, c: m.ghostStart.c + 1 }, dir: DIRS.Right, color: "#ec4899", scared: 0 },
      { pos: { r: m.ghostStart.r + 1, c: m.ghostStart.c }, dir: DIRS.Up, color: "#22d3ee", scared: 0 },
    ]);
    setScore(0);
    setLives(3);
    setStatus("playing");
  }, []);

  const respawn = useCallback(() => {
    const m = initial.current;
    setPac(m.pacStart);
    setPacDir(DIRS.None);
    setRequested(DIRS.None);
    setGhosts((prev) => prev.map((g, i) => ({
      ...g,
      pos: { r: m.ghostStart.r + (i === 2 ? 1 : 0), c: m.ghostStart.c + (i === 1 ? 1 : 0) },
      dir: DIRS.Left,
      scared: 0,
    })));
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const t = window.setInterval(() => {
      const t0 = tilesRef.current;
      let p = pacRef.current;
      let dir = pacDirRef.current;
      const req = reqRef.current;

      if (req !== DIRS.None) {
        const np = wrap({ r: p.r + req.dr, c: p.c + req.dc });
        if (canMove(t0, np.r, np.c)) dir = req;
      }
      const next = wrap({ r: p.r + dir.dr, c: p.c + dir.dc });
      if (canMove(t0, next.r, next.c)) { p = next; }
      else { dir = DIRS.None; }

      let newScore = 0;
      let poweredUp = false;
      if (t0[p.r] && (t0[p.r][p.c] === "dot" || t0[p.r][p.c] === "power")) {
        const wasPower = t0[p.r][p.c] === "power";
        const copy = t0.map((row) => [...row]);
        copy[p.r][p.c] = "empty";
        tilesRef.current = copy;
        setTiles(copy);
        newScore = wasPower ? 50 : 10;
        if (wasPower) poweredUp = true;
      }
      if (newScore) setScore((s) => s + newScore);

      const newGhosts = ghostsRef.current.map((g) => {
        const candidates: Dir[] = [];
        for (const d of [DIRS.Up, DIRS.Down, DIRS.Left, DIRS.Right]) {
          if (d.dr === -g.dir.dr && d.dc === -g.dir.dc) continue;
          const np = wrap({ r: g.pos.r + d.dr, c: g.pos.c + d.dc });
          if (canMove(t0, np.r, np.c, true)) candidates.push(d);
        }
        let chosen = candidates[0] || g.dir;
        const toward = g.scared > 0 ? -1 : 1;
        let bestScore = -Infinity;
        for (const d of candidates) {
          const np = wrap({ r: g.pos.r + d.dr, c: g.pos.c + d.dc });
          const dist = Math.abs(np.r - p.r) + Math.abs(np.c - p.c);
          const sc = -dist * toward + Math.random() * 2;
          if (sc > bestScore) { bestScore = sc; chosen = d; }
        }
        const newPos = wrap({ r: g.pos.r + chosen.dr, c: g.pos.c + chosen.dc });
        return { ...g, pos: newPos, dir: chosen, scared: poweredUp ? 30 : Math.max(0, g.scared - 1) };
      });
      ghostsRef.current = newGhosts;

      let remainingGhosts = newGhosts;
      let died = false;
      for (const g of newGhosts) {
        if (g.pos.r === p.r && g.pos.c === p.c) {
          if (g.scared > 0) {
            setScore((s) => s + 200);
            const home = initial.current.ghostStart;
            remainingGhosts = remainingGhosts.map((og) => og === g ? { ...og, pos: { r: home.r, c: home.c }, scared: 0 } : og);
          } else {
            died = true;
          }
        }
      }

      if (died) {
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) setStatus("lost");
          else respawn();
          return Math.max(0, nl);
        });
        return;
      }

      setGhosts(remainingGhosts);
      setPac(p);
      setPacDir(dir);

      const remainingDots = tilesRef.current.some((row) => row.some((c) => c === "dot" || c === "power"));
      if (!remainingDots) setStatus("won");
    }, 140);
    return () => window.clearInterval(t);
  }, [status, respawn]);

  return (
    <div className="space-y-4 w-full px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Pac-Man</h2>
        <p className="mt-2 text-slate-400">Arrows to move. Eat all dots. Power pellets turn ghosts blue.</p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div
          className="relative rounded-xl border border-slate-800 bg-black"
          style={{ width: COLS * CELL, height: ROWS * CELL }}
        >
          {tiles.map((row, r) =>
            row.map((t, c) => (
              <div
                key={`${r}-${c}`}
                className="absolute"
                style={{
                  left: c * CELL, top: r * CELL, width: CELL, height: CELL,
                  background: t === "wall" ? "#1e3a8a" : t === "door" ? "#f472b6" : "transparent",
                }}
              >
                {t === "dot" && (
                  <div
                    className="absolute rounded-full bg-yellow-200"
                    style={{ left: CELL / 2 - 2, top: CELL / 2 - 2, width: 4, height: 4 }}
                  />
                )}
                {t === "power" && (
                  <div
                    className="absolute rounded-full bg-yellow-300"
                    style={{ left: CELL / 2 - 5, top: CELL / 2 - 5, width: 10, height: 10 }}
                  />
                )}
              </div>
            ))
          )}
          {ghosts.map((g, i) => (
            <div
              key={i}
              className="absolute rounded-t-full transition-[left,top] duration-100"
              style={{
                left: g.pos.c * CELL + 1, top: g.pos.r * CELL + 1,
                width: CELL - 2, height: CELL - 2,
                background: g.scared > 0 ? "#60a5fa" : g.color,
              }}
            />
          ))}
          <div
            className="absolute rounded-full bg-yellow-300 transition-[left,top] duration-100"
            style={{ left: pac.c * CELL + 1, top: pac.r * CELL + 1, width: CELL - 2, height: CELL - 2 }}
          />
        </div>

        <div className="flex min-w-[180px] flex-col gap-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3">
            <p>Score: {score}</p>
            <p>Lives: {lives}</p>
            <p>Status: {status}</p>
          </div>
          <button
            onClick={reset}
            className="rounded-2xl bg-violet-500 px-4 py-2 font-semibold text-white hover:bg-violet-400"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}