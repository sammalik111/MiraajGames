"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// Battleship — player vs. computer
//
// Both sides get a 10x10 board with ships of sizes [5, 4, 3, 3, 2] placed at
// random (no overlap, no diagonal). Player clicks the enemy board to fire;
// after each shot the computer fires back. The CPU uses a "hunt + target"
// strategy: random shots until it hits, then targets adjacent cells until it
// sinks the ship.
// -----------------------------------------------------------------------------

const SIZE = 10;
const SHIPS = [5, 4, 3, 3, 2];

type Orientation = "H" | "V";

type Ship = {
  cells: number[]; // board indices
  hits: Set<number>;
};

type Board = {
  ships: Ship[];
  shipAt: (number | null)[]; // length 100; index of ship, or null
};

type Shot = "miss" | "hit" | "sunk" | null;

function makeEmptyBoard(): Board {
  return { ships: [], shipAt: Array(SIZE * SIZE).fill(null) };
}

function tryPlaceShip(board: Board, length: number): boolean {
  for (let attempt = 0; attempt < 200; attempt++) {
    const orient: Orientation = Math.random() < 0.5 ? "H" : "V";
    const r = Math.floor(Math.random() * (orient === "V" ? SIZE - length + 1 : SIZE));
    const c = Math.floor(Math.random() * (orient === "H" ? SIZE - length + 1 : SIZE));
    const cells: number[] = [];
    for (let i = 0; i < length; i++) {
      const rr = orient === "V" ? r + i : r;
      const cc = orient === "H" ? c + i : c;
      cells.push(rr * SIZE + cc);
    }
    if (cells.every((idx) => board.shipAt[idx] === null)) {
      const shipIndex = board.ships.length;
      board.ships.push({ cells, hits: new Set() });
      cells.forEach((idx) => (board.shipAt[idx] = shipIndex));
      return true;
    }
  }
  return false;
}

function makeRandomBoard(): Board {
  while (true) {
    const b = makeEmptyBoard();
    let ok = true;
    for (const len of SHIPS) {
      if (!tryPlaceShip(b, len)) {
        ok = false;
        break;
      }
    }
    if (ok) return b;
  }
}

function neighbors(idx: number): number[] {
  const r = Math.floor(idx / SIZE);
  const c = idx % SIZE;
  const out: number[] = [];
  if (r > 0) out.push(idx - SIZE);
  if (r < SIZE - 1) out.push(idx + SIZE);
  if (c > 0) out.push(idx - 1);
  if (c < SIZE - 1) out.push(idx + 1);
  return out;
}

export default function BattleshipGame() {
  const [playerBoard, setPlayerBoard] = useState<Board>(() => makeRandomBoard());
  const [cpuBoard, setCpuBoard] = useState<Board>(() => makeRandomBoard());
  const [playerShots, setPlayerShots] = useState<Shot[]>(() => Array(100).fill(null));
  const [cpuShots, setCpuShots] = useState<Shot[]>(() => Array(100).fill(null));
  const [turn, setTurn] = useState<"player" | "cpu">("player");
  const [status, setStatus] = useState<string>("Your turn — click the enemy board to fire.");
  const [done, setDone] = useState<false | "player" | "cpu">(false);

  // CPU hunt/target state
  const cpuTargets = useRef<number[]>([]);
  const cpuTried = useRef<Set<number>>(new Set());

  const reset = () => {
    setPlayerBoard(makeRandomBoard());
    setCpuBoard(makeRandomBoard());
    setPlayerShots(Array(100).fill(null));
    setCpuShots(Array(100).fill(null));
    setTurn("player");
    setStatus("Your turn — click the enemy board to fire.");
    setDone(false);
    cpuTargets.current = [];
    cpuTried.current = new Set();
  };

  const allSunk = (b: Board) => b.ships.every((s) => s.hits.size === s.cells.length);

  const fireAt = (target: "cpu" | "player", idx: number): Shot => {
    const board = target === "cpu" ? cpuBoard : playerBoard;
    const shipIdx = board.shipAt[idx];
    if (shipIdx === null) return "miss";
    const ship = board.ships[shipIdx];
    ship.hits.add(idx);
    return ship.hits.size === ship.cells.length ? "sunk" : "hit";
  };

  const handlePlayerFire = (idx: number) => {
    if (done || turn !== "player" || playerShots[idx]) return;
    const result = fireAt("cpu", idx);
    const next = [...playerShots];
    next[idx] = result;
    setPlayerShots(next);
    if (allSunk(cpuBoard)) {
      setDone("player");
      setStatus("🎉 You sank the enemy fleet!");
      return;
    }
    if (result === "sunk") setStatus("You sank an enemy ship!");
    else if (result === "hit") setStatus("Hit!");
    else setStatus("Miss.");
    setTurn("cpu");
  };

  // CPU turn
  useEffect(() => {
    if (done || turn !== "cpu") return;
    const id = setTimeout(() => {
      let pick: number | null = null;
      while (cpuTargets.current.length > 0) {
        const candidate = cpuTargets.current.shift()!;
        if (!cpuTried.current.has(candidate)) {
          pick = candidate;
          break;
        }
      }
      if (pick === null) {
        // random hunt on cells not tried, prefer checkerboard pattern
        const pool: number[] = [];
        for (let i = 0; i < 100; i++) {
          if (cpuTried.current.has(i)) continue;
          const r = Math.floor(i / SIZE);
          const c = i % SIZE;
          if ((r + c) % 2 === 0) pool.push(i);
        }
        const fallback: number[] = [];
        for (let i = 0; i < 100; i++) if (!cpuTried.current.has(i)) fallback.push(i);
        const from = pool.length > 0 ? pool : fallback;
        pick = from[Math.floor(Math.random() * from.length)];
      }
      cpuTried.current.add(pick);
      const result = fireAt("player", pick);
      const next = [...cpuShots];
      next[pick] = result;
      setCpuShots(next);
      if (result === "hit") {
        neighbors(pick).forEach((n) => {
          if (!cpuTried.current.has(n)) cpuTargets.current.push(n);
        });
        setStatus("Enemy hit your ship!");
      } else if (result === "sunk") {
        cpuTargets.current = [];
        setStatus("Enemy sank one of your ships!");
      } else {
        setStatus("Enemy missed.");
      }
      if (allSunk(playerBoard)) {
        setDone("cpu");
        setStatus("💥 Your fleet was sunk. Enemy wins.");
        return;
      }
      setTurn("player");
    }, 600);
    return () => clearTimeout(id);
  }, [turn, done, cpuShots, playerBoard]);

  const cellClass = (shot: Shot, showShip: boolean) => {
    if (shot === "hit" || shot === "sunk") return "bg-red-500";
    if (shot === "miss") return "bg-slate-400";
    if (showShip) return "bg-blue-500";
    return "bg-sky-200 dark:bg-slate-700 hover:bg-sky-300 dark:hover:bg-slate-600";
  };

  const remainingPlayer = useMemo(
    () => playerBoard.ships.filter((s) => s.hits.size < s.cells.length).length,
    [playerBoard, cpuShots]
  );
  const remainingCpu = useMemo(
    () => cpuBoard.ships.filter((s) => s.hits.size < s.cells.length).length,
    [cpuBoard, playerShots]
  );

  return (
    <div className="flex flex-col items-center gap-5">
      <h1 className="text-3xl font-bold text-black dark:text-white">Battleship</h1>
      <div className="text-base font-semibold text-zinc-700 dark:text-zinc-300 h-7">{status}</div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div>
          <h2 className="mb-2 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Enemy waters — {remainingCpu} ship{remainingCpu !== 1 ? "s" : ""} left
          </h2>
          <div
            className="grid gap-0.5 bg-zinc-300 dark:bg-zinc-700 p-1 rounded-md"
            style={{ gridTemplateColumns: `repeat(${SIZE}, 1.75rem)` }}
          >
            {playerShots.map((shot, i) => (
              <button
                key={i}
                onClick={() => handlePlayerFire(i)}
                disabled={done !== false || turn !== "player" || shot !== null}
                className={`h-7 w-7 rounded-sm ${cellClass(shot, false)} disabled:cursor-not-allowed`}
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Your fleet — {remainingPlayer} ship{remainingPlayer !== 1 ? "s" : ""} left
          </h2>
          <div
            className="grid gap-0.5 bg-zinc-300 dark:bg-zinc-700 p-1 rounded-md"
            style={{ gridTemplateColumns: `repeat(${SIZE}, 1.75rem)` }}
          >
            {cpuShots.map((shot, i) => {
              const hasShip = playerBoard.shipAt[i] !== null;
              return (
                <div
                  key={i}
                  className={`h-7 w-7 rounded-sm ${cellClass(shot, hasShip)}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      <button
        onClick={reset}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
      >
        New Game
      </button>
    </div>
  );
}