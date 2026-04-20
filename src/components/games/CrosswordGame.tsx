"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface CellDef {
  letter: string | null;
  num?: number;
}

interface Clue {
  num: number;
  dir: "across" | "down";
  clue: string;
  answer: string;
  row: number;
  col: number;
}

interface Puzzle {
  theme: string;
  rows: number;
  cols: number;
  grid: (CellDef | null)[][];
  clues: Clue[];
}

// ── Puzzle Data ────────────────────────────────────────────────────────────

const PUZZLES: Puzzle[] = [
  {
    theme: "Animals",
    rows: 4,
    cols: 7,
    grid: [
      [
        { letter: "C", num: 1 },
        { letter: "A", num: 2 },
        { letter: "T" },
        null,
        { letter: "F", num: 3 },
        { letter: "O" },
        { letter: "X" },
      ],
      [null, { letter: "R" }, null, null, { letter: "I" }, null, null],
      [null, { letter: "T" }, null, null, { letter: "S" }, null, null],
      [null, null, { letter: "B", num: 4 }, { letter: "U" }, { letter: "G" }, null, null],
    ],
    clues: [
      { num: 1, dir: "across", clue: "Meowing household pet", answer: "CAT", row: 0, col: 0 },
      { num: 2, dir: "down",   clue: "Painting or sculpture", answer: "ART", row: 0, col: 1 },
      { num: 3, dir: "across", clue: "Sly orange woodland creature", answer: "FOX", row: 0, col: 4 },
      { num: 3, dir: "down",   clue: "Underwater swimmer with scales", answer: "FISH", row: 0, col: 4 },
      { num: 4, dir: "across", clue: "Six-legged garden critter", answer: "BUG", row: 3, col: 2 },
    ],
  },
  {
    theme: "Everyday Words",
    rows: 5,
    cols: 4,
    grid: [
      [{ letter: "H", num: 1 }, { letter: "A" }, { letter: "N" }, { letter: "D" }],
      [{ letter: "E" }, null, null, null],
      [{ letter: "N", num: 2 }, { letter: "E", num: 3 }, { letter: "T" }, null],
      [null, { letter: "A" }, null, null],
      [null, { letter: "R" }, null, null],
    ],
    clues: [
      { num: 1, dir: "across", clue: "Palm and five fingers", answer: "HAND", row: 0, col: 0 },
      { num: 1, dir: "down",   clue: "Female chicken",        answer: "HEN",  row: 0, col: 0 },
      { num: 2, dir: "across", clue: "Mesh used for fishing", answer: "NET",  row: 2, col: 0 },
      { num: 3, dir: "down",   clue: "Organ you hear with",   answer: "EAR",  row: 2, col: 1 },
    ],
  },
  {
    theme: "Short & Sweet",
    rows: 3,
    cols: 4,
    grid: [
      [{ letter: "C", num: 1 }, { letter: "A", num: 2 }, { letter: "P", num: 3 }, { letter: "E" }],
      [null, { letter: "P", num: 4 }, { letter: "O" }, { letter: "D" }],
      [{ letter: "P", num: 5 }, { letter: "E" }, { letter: "T" }, null],
    ],
    clues: [
      { num: 1, dir: "across", clue: "Superhero's flowing garment", answer: "CAPE", row: 0, col: 0 },
      { num: 2, dir: "down",   clue: "Great ape relative",          answer: "APE",  row: 0, col: 1 },
      { num: 3, dir: "down",   clue: "Cooking vessel",              answer: "POT",  row: 0, col: 2 },
      { num: 4, dir: "across", clue: "Peas grow in one",            answer: "POD",  row: 1, col: 1 },
      { num: 5, dir: "across", clue: "Domestic animal",             answer: "PET",  row: 2, col: 0 },
    ],
  },
];

// ── Helper ─────────────────────────────────────────────────────────────────

function buildAnswerMap(puzzle: Puzzle): Map<string, string> {
  const map = new Map<string, string>();
  puzzle.clues.forEach((clue) => {
    for (let i = 0; i < clue.answer.length; i++) {
      const r = clue.dir === "down" ? clue.row + i : clue.row;
      const c = clue.dir === "across" ? clue.col + i : clue.col;
      map.set(`${r},${c}`, clue.answer[i]);
    }
  });
  return map;
}

// ── Ad Placeholder ─────────────────────────────────────────────────────────

function AdPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-slate-500 font-semibold tracking-widest uppercase">
        Advertisement
      </span>
      <div
        className="rounded border border-slate-600 bg-slate-800 flex items-center justify-center text-slate-500 text-sm font-medium"
        style={{ width: 300, height: 250 }}
      >
        300 × 250 Ad
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CrosswordGame() {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const puzzle = PUZZLES[puzzleIndex];

  const [userInput, setUserInput] = useState<Map<string, string>>(new Map());
  const [checked, setChecked] = useState(false);
  const [solved, setSolved] = useState(false);
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [cursor, setCursor] = useState<{ r: number; c: number } | null>(null);

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const answerMap = buildAnswerMap(puzzle);

  const resetForPuzzle = useCallback(() => {
    setUserInput(new Map());
    setChecked(false);
    setSolved(false);
    setDirection("across");
    setCursor(null);
    inputRefs.current.clear();
  }, []);

  useEffect(() => {
    resetForPuzzle();
  }, [puzzleIndex, resetForPuzzle]);

  const focusCell = (r: number, c: number) => {
    const key = `${r},${c}`;
    const el = inputRefs.current.get(key);
    if (el) el.focus();
    setCursor({ r, c });
  };

  const advanceCursor = (r: number, c: number, dir: "across" | "down") => {
    const dr = dir === "down" ? 1 : 0;
    const dc = dir === "across" ? 1 : 0;
    let nr = r + dr;
    let nc = c + dc;
    while (nr < puzzle.rows && nc < puzzle.cols) {
      if (puzzle.grid[nr] && puzzle.grid[nr][nc] !== null) {
        focusCell(nr, nc);
        return;
      }
      nr += dr;
      nc += dc;
    }
  };

  const handleCellChange = (r: number, c: number, val: string) => {
    const char = val.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
    setUserInput((prev) => {
      const next = new Map(prev);
      if (char) next.set(`${r},${c}`, char);
      else next.delete(`${r},${c}`);
      return next;
    });
    setChecked(false);
    setSolved(false);
    if (char) advanceCursor(r, c, direction);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === "Tab") {
      e.preventDefault();
      setDirection((d) => (d === "across" ? "down" : "across"));
      return;
    }
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      let nr = r + dr;
      let nc = c + dc;
      while (nr >= 0 && nr < puzzle.rows && nc >= 0 && nc < puzzle.cols) {
        if (puzzle.grid[nr] && puzzle.grid[nr][nc] !== null) {
          focusCell(nr, nc);
          return;
        }
        nr += dr;
        nc += dc;
      }
      return;
    }
    if (e.key === "Backspace") {
      const key = `${r},${c}`;
      if (userInput.get(key)) {
        setUserInput((prev) => { const n = new Map(prev); n.delete(key); return n; });
      } else {
        const dr = direction === "down" ? -1 : 0;
        const dc = direction === "across" ? -1 : 0;
        let nr = r + dr; let nc = c + dc;
        while (nr >= 0 && nr < puzzle.rows && nc >= 0 && nc < puzzle.cols) {
          if (puzzle.grid[nr] && puzzle.grid[nr][nc] !== null) {
            focusCell(nr, nc);
            setUserInput((prev) => { const n = new Map(prev); n.delete(`${nr},${nc}`); return n; });
            return;
          }
          nr += dr; nc += dc;
        }
      }
    }
  };

  const handleCheck = () => {
    setChecked(true);
    let allCorrect = true;
    for (const [key, answer] of answerMap.entries()) {
      if ((userInput.get(key) ?? "").toUpperCase() !== answer) { allCorrect = false; break; }
    }
    setSolved(allCorrect);
  };

  const handleNext = () => {
    if (puzzleIndex < PUZZLES.length - 1) setPuzzleIndex((i) => i + 1);
    else setAllDone(true);
  };

  const getCellBg = (r: number, c: number): string => {
    if (!checked) return "bg-white";
    const answer = answerMap.get(`${r},${c}`);
    if (!answer) return "bg-white";
    const entered = userInput.get(`${r},${c}`) ?? "";
    if (entered.toUpperCase() === answer) return "bg-green-200";
    if (entered) return "bg-red-200";
    return "bg-yellow-100";
  };

  const CELL = 42;

  if (allDone) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-white mb-2">All Puzzles Complete!</h2>
          <p className="text-slate-400 mb-6">You solved all 3 crossword puzzles!</p>
          <button
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
            onClick={() => { setPuzzleIndex(0); setAllDone(false); }}
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Crossword Puzzle</h1>
            <p className="text-slate-400 text-sm">
              Theme: <span className="text-yellow-400 font-semibold">{puzzle.theme}</span>
            </p>
          </div>
          <div className="bg-slate-700 rounded-xl px-5 py-2 text-center">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Puzzle</div>
            <div className="text-2xl font-bold text-yellow-400">
              {puzzleIndex + 1} / {PUZZLES.length}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800 rounded-lg px-4 py-2 mb-5 text-sm text-slate-300 flex flex-wrap gap-4">
          <span>Type letters into white cells</span>
          <span>•</span>
          <span>Arrow keys move cursor</span>
          <span>•</span>
          <span>Tab toggles direction</span>
          <span>•</span>
          <span>
            Direction:{" "}
            <span className="text-blue-400 font-semibold uppercase">{direction}</span>
          </span>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Grid + Clues */}
          <div className="flex-1">
            {solved && (
              <div className="mb-4 bg-green-700 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-lg font-bold">🎉 Puzzle {puzzleIndex + 1} complete!</span>
                <button
                  className="bg-white text-green-800 font-semibold px-4 py-1 rounded-lg hover:bg-green-100 transition"
                  onClick={handleNext}
                >
                  {puzzleIndex < PUZZLES.length - 1 ? "Next Puzzle →" : "Finish! 🏆"}
                </button>
              </div>
            )}

            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${puzzle.cols}, ${CELL}px)`,
                gap: 2,
                padding: 2,
                backgroundColor: "#334155",
                width: "fit-content",
                borderRadius: 4,
              }}
            >
              {puzzle.grid.map((row, r) =>
                row.map((cell, c) => {
                  if (cell === null) {
                    return (
                      <div
                        key={`${r}-${c}`}
                        style={{ width: CELL, height: CELL }}
                        className="bg-slate-700"
                      />
                    );
                  }
                  const key = `${r},${c}`;
                  const val = userInput.get(key) ?? "";
                  const isCursor = cursor?.r === r && cursor?.c === c;
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`relative ${getCellBg(r, c)} ${
                        isCursor ? "ring-2 ring-blue-500 ring-inset" : ""
                      }`}
                      style={{ width: CELL, height: CELL }}
                    >
                      {cell.num !== undefined && (
                        <span
                          className="absolute top-0 left-0.5 text-slate-700 font-bold leading-none select-none pointer-events-none"
                          style={{ fontSize: 9, zIndex: 1 }}
                        >
                          {cell.num}
                        </span>
                      )}
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(key, el);
                          else inputRefs.current.delete(key);
                        }}
                        type="text"
                        maxLength={2}
                        value={val}
                        onChange={(e) => handleCellChange(r, c, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, r, c)}
                        onFocus={() => setCursor({ r, c })}
                        className="absolute inset-0 w-full h-full text-center font-bold text-lg uppercase bg-transparent outline-none text-slate-900 cursor-pointer"
                        style={{ paddingTop: 8 }}
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition"
                onClick={handleCheck}
              >
                Check Answers
              </button>
              <button
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
                onClick={resetForPuzzle}
              >
                Clear
              </button>
            </div>

            {/* Clues */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(["across", "down"] as const).map((dir) => (
                <div key={dir}>
                  <h3 className="font-bold text-yellow-400 uppercase text-sm mb-2 border-b border-slate-700 pb-1">
                    {dir}
                  </h3>
                  <ul className="space-y-2">
                    {puzzle.clues
                      .filter((cl) => cl.dir === dir)
                      .map((cl) => (
                        <li key={`${cl.num}-${cl.dir}`} className="text-sm text-slate-300">
                          <span className="text-white font-semibold mr-1">{cl.num}.</span>
                          {cl.clue}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="flex-shrink-0 flex flex-col items-start gap-4">
            <AdPlaceholder />
            <div className="bg-slate-800 rounded-lg p-4 w-full">
              <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wide">Progress</h3>
              {PUZZLES.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 py-1 text-sm ${
                    i === puzzleIndex ? "text-yellow-400 font-bold" : "text-slate-500"
                  }`}
                >
                  <span>{i + 1}.</span>
                  <span>{p.theme}</span>
                  {i < puzzleIndex && <span className="text-green-400 ml-auto">✓</span>}
                  {i === puzzleIndex && (
                    <span className="text-xs bg-yellow-400 text-slate-900 px-1 rounded ml-auto">now</span>
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