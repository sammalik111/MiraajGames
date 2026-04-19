"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Cell = { answer: string; number?: number };
type Dir = "across" | "down";

const _ = ""; // blank
const G: (string | [string, number])[][] = [
  [["C", 1], "A", "T", _, ["D", 2], "O", "G"],
  ["O", _, _, _, "R", _, "A"],
  [["D", 3], "A", "W", "N", "O", _, "M"],
  ["E", _, _, _, ["N", 4], "E", "T"],
  [_, _, _, _, "E", _, _],
  [["S", 5], "U", "N", _, _, _, _],
  ["K", _, _, _, _, _, _],
];

const clues: { num: number; dir: Dir; text: string; answer: string }[] = [
  { num: 1, dir: "across", text: "Feline pet", answer: "CAT" },
  { num: 1, dir: "down", text: "Programmer's term, rhymes with 'mode'", answer: "CODESK".slice(0, 4) },
  { num: 2, dir: "across", text: "Man's best friend", answer: "DOG" },
  { num: 2, dir: "down", text: "Unmanned aircraft", answer: "DRONE" },
  { num: 3, dir: "across", text: "Sunrise", answer: "DAWNO".slice(0, 4) },
  { num: 4, dir: "down", text: "Fishing device", answer: "NET" },
  { num: 5, dir: "across", text: "Star that warms us", answer: "SUN" },
];

const ROWS = G.length;
const COLS = G[0].length;

function buildGrid(): (Cell | null)[][] {
  return G.map((row) =>
    row.map((c) => {
      if (c === _) return null;
      if (Array.isArray(c)) return { answer: c[0] as string, number: c[1] as number };
      return { answer: c as string };
    })
  );
}

export default function CrosswordGame() {
  const grid = useMemo(buildGrid, []);
  const [entries, setEntries] = useState<string[][]>(
    () => grid.map((row) => row.map(() => ""))
  );
  const [cursor, setCursor] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [dir, setDir] = useState<Dir>("across");
  const [message, setMessage] = useState("Type letters. Tab toggles across/down.");
  const inputsRef = useRef<(HTMLInputElement | null)[][]>(
    Array.from({ length: ROWS }, () => Array(COLS).fill(null))
  );

  useEffect(() => {
    const cell = grid[cursor.r]?.[cursor.c];
    if (!cell) {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) { setCursor({ r, c }); return; }
      }
    }
  }, [grid, cursor.r, cursor.c]);

  const focusCell = (r: number, c: number) => {
    const input = inputsRef.current[r]?.[c];
    if (input) input.focus();
  };

  const advance = (r: number, c: number) => {
    const nr = dir === "down" ? r + 1 : r;
    const nc = dir === "across" ? c + 1 : c;
    if (nr < ROWS && nc < COLS && grid[nr][nc]) {
      setCursor({ r: nr, c: nc });
      focusCell(nr, nc);
    }
  };

  const retreat = (r: number, c: number) => {
    const nr = dir === "down" ? r - 1 : r;
    const nc = dir === "across" ? c - 1 : c;
    if (nr >= 0 && nc >= 0 && grid[nr][nc]) {
      setCursor({ r: nr, c: nc });
      focusCell(nr, nc);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === "Tab") { e.preventDefault(); setDir(dir === "across" ? "down" : "across"); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); setDir("across"); advance(r, c); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); setDir("across"); retreat(r, c); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setDir("down"); advance(r, c); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setDir("down"); retreat(r, c); return; }
    if (e.key === "Backspace") {
      e.preventDefault();
      setEntries((prev) => {
        const next = prev.map((row) => [...row]);
        if (next[r][c]) next[r][c] = "";
        else { retreat(r, c); return next; }
        return next;
      });
      return;
    }
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      setEntries((prev) => {
        const next = prev.map((row) => [...row]);
        next[r][c] = e.key.toUpperCase();
        return next;
      });
      advance(r, c);
    }
  };

  const check = () => {
    let ok = true;
    let wrong = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c];
        if (!cell) continue;
        if ((entries[r][c] || "").toUpperCase() !== cell.answer) { ok = false; wrong++; }
      }
    }
    setMessage(ok ? "Solved! 🎉" : `${wrong} incorrect square${wrong === 1 ? "" : "s"}.`);
  };

  const reveal = () => {
    setEntries(grid.map((row) => row.map((c) => (c ? c.answer : ""))));
    setMessage("Revealed.");
  };

  const clear = () => {
    setEntries(grid.map((row) => row.map(() => "")));
    setMessage("Cleared.");
  };

  return (
    <div className="space-y-6 w-full max-w-3xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Mini Crossword</h2>
        <p className="mt-2 text-slate-400">Type letters. Tab switches direction. Arrows navigate.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto,1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3">
          <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 2.25rem)` }}>
            {grid.map((row, r) =>
              row.map((cell, c) => {
                if (!cell) return <div key={`${r}-${c}`} className="h-9 w-9 bg-slate-800" />;
                const active = cursor.r === r && cursor.c === c;
                return (
                  <div key={`${r}-${c}`} className="relative h-9 w-9 border border-slate-700 bg-white">
                    {cell.number && (
                      <span className="absolute left-[2px] top-0 text-[9px] font-semibold text-slate-600">
                        {cell.number}
                      </span>
                    )}
                    <input
                      ref={(el) => { inputsRef.current[r][c] = el; }}
                      value={entries[r][c]}
                      onChange={() => {}}
                      onFocus={() => setCursor({ r, c })}
                      onKeyDown={(e) => onKey(e, r, c)}
                      className={`h-full w-full text-center text-base font-bold uppercase text-slate-900 outline-none ${active ? "bg-yellow-200" : "bg-white"}`}
                      maxLength={1}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-sm text-slate-300">
            <h3 className="mb-2 font-semibold text-white">Across</h3>
            <ul className="space-y-1">
              {clues.filter((c) => c.dir === "across").map((c) => (
                <li key={`a-${c.num}`}>{c.num}. {c.text}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-sm text-slate-300">
            <h3 className="mb-2 font-semibold text-white">Down</h3>
            <ul className="space-y-1">
              {clues.filter((c) => c.dir === "down").map((c) => (
                <li key={`d-${c.num}`}>{c.num}. {c.text}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={check} className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400">Check</button>
        <button onClick={reveal} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400">Reveal</button>
        <button onClick={clear} className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400">Clear</button>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-2 text-sm text-slate-300">{message}</div>
      </div>
    </div>
  );
}