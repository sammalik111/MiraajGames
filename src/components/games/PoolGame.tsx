"use client";

import React, { useEffect, useRef, useState } from "react";

const TABLE_W = 480;
const TABLE_H = 288;
const BALL_R = 10;
const FRICTION = 0.972;
const MIN_SPEED = 0.05;

type BallType = "solid" | "stripe" | "8" | "cue";
type Ball = {
  x: number; y: number; dx: number; dy: number;
  color: string; id: number; potted: boolean; type: BallType;
};

const POCKETS = [
  { x: 14, y: 14 }, { x: TABLE_W / 2, y: 10 }, { x: TABLE_W - 14, y: 14 },
  { x: 14, y: TABLE_H - 14 }, { x: TABLE_W / 2, y: TABLE_H - 10 }, { x: TABLE_W - 14, y: TABLE_H - 14 },
];
const POCKET_R = 15;

const SOLID_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#ca8a04"];
const STRIPE_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#ca8a04"];

const startBalls = (): Ball[] => {
  const balls: Ball[] = [
    { id: 0, x: Math.round(TABLE_W * 0.25), y: TABLE_H / 2, dx: 0, dy: 0, color: "#ffffff", potted: false, type: "cue" },
  ];
  const rackOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const positions: { row: number; col: number }[] = [];
  for (let row = 0; row < 5; row++)
    for (let col = 0; col <= row; col++) positions.push({ row, col });
  for (let i = 0; i < Math.min(rackOrder.length, positions.length); i++) {
    const id = rackOrder[i];
    const { row, col } = positions[i];
    const isSolid = id >= 1 && id <= 7;
    const is8 = id === 8;
    balls.push({
      id,
      x: Math.round(TABLE_W * 0.66) + row * (BALL_R * 2 + 0.5),
      y: TABLE_H / 2 - row * BALL_R + col * (BALL_R * 2 + 0.5),
      dx: 0, dy: 0,
      color: is8 ? "#111827" : isSolid ? SOLID_COLORS[(id - 1) % 7] : STRIPE_COLORS[(id - 9) % 7],
      potted: false,
      type: is8 ? "8" : isSolid ? "solid" : "stripe",
    });
  }
  return balls;
};

function findCueSpot(liveBalls: Ball[]): { x: number; y: number } {
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = BALL_R * 2 + Math.random() * (TABLE_W * 0.4 - BALL_R * 4);
    const y = BALL_R * 2 + Math.random() * (TABLE_H - BALL_R * 4);
    const clear = liveBalls.every((b) => Math.hypot(b.x - x, b.y - y) > BALL_R * 2.6);
    const notNearPocket = POCKETS.every((p) => Math.hypot(p.x - x, p.y - y) > POCKET_R + BALL_R + 4);
    if (clear && notNearPocket) return { x, y };
  }
  return { x: TABLE_W * 0.15, y: TABLE_H / 2 };
}

function BallView({ b, r }: { b: Ball; r: number }) {
  const size = r * 2;
  if (b.type === "cue") {
    return (
      <div className="absolute rounded-full shadow" style={{
        left: b.x - r, top: b.y - r, width: size, height: size,
        background: "radial-gradient(circle at 35% 35%, #fff 0%, #ddd 100%)",
        border: "1px solid #bbb",
      }} />
    );
  }
  if (b.type === "solid") {
    return (
      <div className="absolute rounded-full shadow flex items-center justify-center overflow-hidden" style={{
        left: b.x - r, top: b.y - r, width: size, height: size,
        background: b.color, border: "1px solid rgba(0,0,0,0.35)",
      }}>
        <div className="rounded-full bg-white/80 flex items-center justify-center" style={{ width: r * 0.9, height: r * 0.9 }}>
          <span style={{ fontSize: r * 0.52, fontWeight: 700, color: "#111", lineHeight: 1 }}>{b.id}</span>
        </div>
      </div>
    );
  }
  if (b.type === "stripe") {
    return (
      <div className="absolute rounded-full shadow overflow-hidden flex items-center justify-center" style={{
        left: b.x - r, top: b.y - r, width: size, height: size,
        background: "#f8f8f8", border: "1px solid rgba(0,0,0,0.25)",
      }}>
        <div className="absolute" style={{ top: "28%", left: 0, right: 0, height: "44%", background: b.color }} />
        <div className="relative z-10 rounded-full bg-white/85 flex items-center justify-center" style={{ width: r * 0.9, height: r * 0.9 }}>
          <span style={{ fontSize: r * 0.52, fontWeight: 700, color: "#111", lineHeight: 1 }}>{b.id}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute rounded-full shadow flex items-center justify-center overflow-hidden" style={{
      left: b.x - r, top: b.y - r, width: size, height: size,
      background: "#111827", border: "1px solid rgba(0,0,0,0.5)",
    }}>
      <div className="rounded-full bg-white/80 flex items-center justify-center" style={{ width: r * 0.9, height: r * 0.9 }}>
        <span style={{ fontSize: r * 0.52, fontWeight: 700, color: "#111", lineHeight: 1 }}>8</span>
      </div>
    </div>
  );
}

export default function PoolGame() {
  const [balls, setBalls] = useState<Ball[]>(startBalls);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [power, setPower] = useState(6);
  const [shots, setShots] = useState(0);
  const [message, setMessage] = useState("Your turn. Click the table to aim, then Shoot.");
  const [currentPlayer, setCurrentPlayer] = useState<"player" | "computer">("player");
  const [computerAim, setComputerAim] = useState<{ x: number; y: number } | null>(null);
  const [playerType, setPlayerType] = useState<"solids" | "stripes" | null>(null);
  const [computerType, setComputerType] = useState<"solids" | "stripes" | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const ballsRef = useRef(balls);
  const hasShotRef = useRef(false);
  const currentPlayerRef = useRef(currentPlayer);
  const playerTypeRef = useRef(playerType);
  const computerTypeRef = useRef(computerType);
  const preShotPottedRef = useRef<Set<number>>(new Set());
  const whoShotRef = useRef<"player" | "computer">("player");
  const awaitingResolutionRef = useRef(false);
  ballsRef.current = balls;
  currentPlayerRef.current = currentPlayer;
  playerTypeRef.current = playerType;
  computerTypeRef.current = computerType;

  // Physics tick
  useEffect(() => {
    const tick = window.setInterval(() => {
      setBalls((prev) => {
        const next = prev.map((b) => ({ ...b }));
        for (const b of next) {
          if (b.potted) continue;
          b.x += b.dx;
          b.y += b.dy;
          if (b.x < BALL_R) { b.x = BALL_R; b.dx = -b.dx * 0.88; }
          if (b.x > TABLE_W - BALL_R) { b.x = TABLE_W - BALL_R; b.dx = -b.dx * 0.88; }
          if (b.y < BALL_R) { b.y = BALL_R; b.dy = -b.dy * 0.88; }
          if (b.y > TABLE_H - BALL_R) { b.y = TABLE_H - BALL_R; b.dy = -b.dy * 0.88; }
          b.dx *= FRICTION;
          b.dy *= FRICTION;
          if (Math.abs(b.dx) < MIN_SPEED) b.dx = 0;
          if (Math.abs(b.dy) < MIN_SPEED) b.dy = 0;
          for (const p of POCKETS) {
            if (Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R) {
              b.potted = true; b.dx = 0; b.dy = 0;
            }
          }
        }
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i], c = next[j];
            if (a.potted || c.potted) continue;
            const dx = c.x - a.x, dy = c.y - a.y;
            const dist = Math.hypot(dx, dy);
            if (dist < BALL_R * 2 && dist > 0) {
              const nx = dx / dist, ny = dy / dist;
              const ov = BALL_R * 2 - dist;
              a.x -= nx * ov / 2; a.y -= ny * ov / 2;
              c.x += nx * ov / 2; c.y += ny * ov / 2;
              const kx = a.dx - c.dx, ky = a.dy - c.dy;
              const dot = kx * nx + ky * ny;
              if (dot > 0) { a.dx -= dot * nx; a.dy -= dot * ny; c.dx += dot * nx; c.dy += dot * ny; }
            }
          }
        }
        return next;
      });
    }, 16);
    return () => window.clearInterval(tick);
  }, []);

  // Assign ball types on first legal pocket
  useEffect(() => {
    if (playerTypeRef.current || computerTypeRef.current) return;
    for (const b of balls) {
      if (!b.potted || b.type === "cue" || b.type === "8") continue;
      const pType = b.type === "solid" ? "solids" : "stripes";
      const cType = pType === "solids" ? "stripes" : "solids";
      if (currentPlayerRef.current === "player") { setPlayerType(pType); setComputerType(cType); }
      else { setComputerType(pType); setPlayerType(cType); }
      break;
    }
  }, [balls]);

  // Post-shot resolution
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!awaitingResolutionRef.current) return;
      const moving = ballsRef.current.some((b) => !b.potted && (b.dx !== 0 || b.dy !== 0));
      if (moving) return;

      awaitingResolutionRef.current = false;
      const shooter = whoShotRef.current;
      const newlyPotted = ballsRef.current.filter(
        (b) => b.potted && !preShotPottedRef.current.has(b.id)
      );

      // Cue ball potted → foul: respawn cue, switch turn
      const cuePotted = newlyPotted.some((b) => b.type === "cue");
      if (cuePotted) {
        const live = ballsRef.current.filter((b) => !b.potted && b.type !== "cue");
        const pos = findCueSpot(live);
        setBalls((prev) =>
          prev.map((b) => b.id === 0 ? { ...b, x: pos.x, y: pos.y, dx: 0, dy: 0, potted: false } : b)
        );
        const next = shooter === "player" ? "computer" : "player";
        setCurrentPlayer(next);
        if (next === "computer") hasShotRef.current = false;
        setMessage(`Cue ball potted — foul! ${next === "player" ? "Your" : "Computer's"} turn.`);
        return;
      }

      // 8-ball potted → win if all own balls cleared, otherwise lose
      if (newlyPotted.some((b) => b.type === "8")) {
        const sType8 = shooter === "player" ? playerTypeRef.current : computerTypeRef.current;
        const myBallType = sType8 === "solids" ? "solid" : "stripe";
        const allCleared = !!sType8 && ballsRef.current
          .filter((b) => b.type === myBallType)
          .every((b) => b.potted);
        setGameOver(true);
        if (allCleared) {
          setMessage(shooter === "player"
            ? "You sank the 8-ball — you win! 🏆"
            : "Computer sank the 8-ball — computer wins! 💀");
        } else {
          setMessage(shooter === "player"
            ? "You sank the 8-ball too early — you lose! 💀"
            : "Computer sank the 8-ball too early — you win! 🎉");
        }
        return;
      }

      const sType = shooter === "player" ? playerTypeRef.current : computerTypeRef.current;

      // Check if shooter potted any opponent ball (foul) — only once types are assigned
      const pottedOpponent = sType && newlyPotted.some((b) => {
        const wrongType = sType === "solids" ? "stripe" : "solid";
        return b.type === wrongType;
      });

      // Check if shooter potted their own ball
      const sunkOwn = newlyPotted.some((b) => {
        if (!sType) return b.type !== "8" && b.type !== "cue";
        return b.type === (sType === "solids" ? "solid" : "stripe");
      });

      if (pottedOpponent && !sunkOwn) {
        // Foul: only opponent balls went in → switch turn
        const next = shooter === "player" ? "computer" : "player";
        setCurrentPlayer(next);
        if (next === "computer") hasShotRef.current = false;
        setMessage(`Foul — wrong ball! ${next === "player" ? "Your" : "Computer's"} turn.`);
      } else if (sunkOwn) {
        // Potted own ball (regardless of also potting opponent) → bonus turn
        setCurrentPlayer(shooter);
        if (shooter === "computer") hasShotRef.current = false;
        setMessage(shooter === "player" ? "You potted — shoot again!" : "Computer potted — goes again...");
      } else {
        // Miss → switch
        const next = shooter === "player" ? "computer" : "player";
        setCurrentPlayer(next);
        if (next === "computer") hasShotRef.current = false;
        setMessage(next === "player" ? "Your turn. Click to aim, then Shoot." : "Computer's turn...");
      }
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  // Computer AI — ghost-ball technique
  useEffect(() => {
    const id = window.setInterval(() => {
      if (gameOver) return;
      const moving = ballsRef.current.some((b) => !b.potted && (b.dx !== 0 || b.dy !== 0));
      if (moving || currentPlayerRef.current !== "computer" || hasShotRef.current || awaitingResolutionRef.current) return;
      hasShotRef.current = true;

      const cue = ballsRef.current.find((b) => b.id === 0);
      if (!cue || cue.potted) { hasShotRef.current = false; setCurrentPlayer("player"); return; }

      const myType = computerTypeRef.current;
      const candidates = ballsRef.current.filter((b) => {
        if (b.potted || b.id === 0) return false;
        if (!myType) return b.type !== "8";
        return b.type === (myType === "solids" ? "solid" : "stripe");
      });
      const fallback = ballsRef.current.filter((b) => !b.potted && b.id !== 0);
      const pool = candidates.length > 0 ? candidates : fallback;
      if (!pool.length) { hasShotRef.current = false; return; }

      // Score each ball: prefer balls closest to a pocket
      const nearestPocket = (b: Ball) =>
        POCKETS.reduce<{ pocket: typeof POCKETS[0]; dist: number }>(
          (best, p) => {
            const d = Math.hypot(b.x - p.x, b.y - p.y);
            return d < best.dist ? { pocket: p, dist: d } : best;
          },
          { pocket: POCKETS[0], dist: Infinity }
        );

      // 10% chance pick random ball, otherwise pick best-positioned ball
      const useRandom = Math.random() < 0.1;
      const target = useRandom
        ? pool[Math.floor(Math.random() * pool.length)]
        : pool.reduce((best, b) => nearestPocket(b).dist < nearestPocket(best).dist ? b : best);

      // Ghost-ball: position cue should aim at (behind target toward nearest pocket)
      const { pocket } = nearestPocket(target);
      const ptx = target.x - pocket.x, pty = target.y - pocket.y;
      const ptd = Math.hypot(ptx, pty) || 1;
      const ghostX = target.x + (ptx / ptd) * BALL_R * 2;
      const ghostY = target.y + (pty / ptd) * BALL_R * 2;

      setComputerAim({ x: ghostX, y: ghostY });
      setMessage("Computer is aiming...");

      setTimeout(() => {
        const freshCue = ballsRef.current.find((b) => b.id === 0);
        if (!freshCue || freshCue.potted) { hasShotRef.current = false; return; }
        const dx = ghostX - freshCue.x;
        const dy = ghostY - freshCue.y;
        // ±6° jitter for ~90% accuracy
        const jitter = (Math.random() - 0.5) * (Math.PI / 15);
        const angle = Math.atan2(dy, dx) + jitter;
        const compPower = 4 + Math.random() * 6;
        preShotPottedRef.current = new Set(ballsRef.current.filter((b) => b.potted).map((b) => b.id));
        whoShotRef.current = "computer";
        awaitingResolutionRef.current = true;
        setBalls((prev) =>
          prev.map((b) => b.id === 0 ? { ...b, dx: Math.cos(angle) * compPower, dy: Math.sin(angle) * compPower } : b)
        );
        setComputerAim(null);
        setShots((s) => s + 1);
        setMessage("Computer shot!");
      }, 1400);
    }, 60);
    return () => window.clearInterval(id);
  }, [gameOver]);

  const onTableClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentPlayer !== "player") return;
    const rect = e.currentTarget.getBoundingClientRect();
    setAim({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const shoot = () => {
    if (gameOver) return;
    if (currentPlayer !== "player") { setMessage("Wait — computer is thinking."); return; }
    if (!aim) { setMessage("Click the table first to aim."); return; }
    const cue = ballsRef.current.find((b) => b.id === 0);
    if (!cue || cue.potted) { setMessage("Cue ball not in play."); return; }
    if (ballsRef.current.some((b) => !b.potted && (b.dx !== 0 || b.dy !== 0))) {
      setMessage("Wait for balls to stop."); return;
    }
    preShotPottedRef.current = new Set(ballsRef.current.filter((b) => b.potted).map((b) => b.id));
    whoShotRef.current = "player";
    awaitingResolutionRef.current = true;
    const dx = aim.x - cue.x, dy = aim.y - cue.y;
    const d = Math.hypot(dx, dy) || 1;
    setBalls((prev) => prev.map((b) => b.id === 0 ? { ...b, dx: (dx / d) * power, dy: (dy / d) * power } : b));
    setAim(null);
    setShots((s) => s + 1);
    setMessage("Shot!");
  };

  const reset = () => {
    setBalls(startBalls());
    setShots(0);
    setAim(null);
    setComputerAim(null);
    setCurrentPlayer("player");
    setPlayerType(null);
    setComputerType(null);
    setGameOver(false);
    hasShotRef.current = false;
    awaitingResolutionRef.current = false;
    preShotPottedRef.current = new Set();
    setMessage("Your turn. Click the table to aim, then Shoot.");
  };

  const potted = balls.filter((b) => b.potted && b.id !== 0).length;
  const cue = balls.find((b) => b.id === 0);

  return (
    <div className="space-y-6 w-full max-w-3xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">8 Ball Pool</h2>
        <p className="mt-2 text-slate-400">Click to aim, Shoot to fire. Pot your type to keep your turn. Wrong type or cue ball = foul.</p>
      </div>

      <div
        onClick={onTableClick}
        className="relative mx-auto cursor-crosshair rounded-[1.5rem] border-4 border-amber-900 bg-green-700 shadow-inner select-none"
        style={{ width: TABLE_W, height: TABLE_H }}
      >
        {POCKETS.map((p, i) => (
          <div key={i} className="absolute rounded-full bg-black"
            style={{ left: p.x - POCKET_R, top: p.y - POCKET_R, width: POCKET_R * 2, height: POCKET_R * 2 }} />
        ))}

        {balls.filter((b) => !b.potted).map((b) => (
          <BallView key={b.id} b={b} r={BALL_R} />
        ))}

        {aim && cue && !cue.potted && (
          <svg className="absolute inset-0 pointer-events-none" width={TABLE_W} height={TABLE_H}>
            <line x1={cue.x} y1={cue.y} x2={aim.x} y2={aim.y}
              stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} strokeDasharray="4 3" />
            <circle cx={aim.x} cy={aim.y} r={4} fill="rgba(255,255,255,0.5)" />
          </svg>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[1.1rem] bg-black/70 z-20">
            <p className="text-center text-base font-bold text-white px-4 leading-snug">{message}</p>
          </div>
        )}

        {computerAim && cue && !cue.potted && (
          <svg className="absolute inset-0 pointer-events-none" width={TABLE_W} height={TABLE_H}>
            <line x1={cue.x} y1={cue.y} x2={computerAim.x} y2={computerAim.y}
              stroke="#f87171" strokeWidth={2} strokeDasharray="5 3" />
            <circle cx={computerAim.x} cy={computerAim.y} r={10} fill="none" stroke="#f87171" strokeWidth={2} opacity={0.9} />
            <circle cx={computerAim.x} cy={computerAim.y} r={5} fill="#f87171" opacity={0.7} />
            <line x1={cue.x - 5} y1={cue.y} x2={cue.x + 5} y2={cue.y} stroke="#f87171" strokeWidth={2} />
            <line x1={cue.x} y1={cue.y - 5} x2={cue.x} y2={cue.y + 5} stroke="#f87171" strokeWidth={2} />
          </svg>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-amber-500 border border-black/30 flex items-center justify-center">
            <span className="text-white font-bold" style={{ fontSize: 6 }}>1</span>
          </div>
          <span>Solid (1–7)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-white overflow-hidden border border-black/20 relative flex items-center justify-center">
            <div className="absolute" style={{ top: "28%", left: 0, right: 0, height: "44%", background: "#3b82f6" }} />
            <span className="relative z-10 font-bold" style={{ fontSize: 6, color: "#111" }}>9</span>
          </div>
          <span>Stripe (9–15)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-gray-900 border border-black/50 flex items-center justify-center">
            <span className="text-white font-bold" style={{ fontSize: 6 }}>8</span>
          </div>
          <span>8-ball (last)</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <button onClick={shoot}
          className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-40"
          disabled={currentPlayer !== "player" || gameOver}>
          Shoot
        </button>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          <label className="block text-slate-400">Power: {power.toFixed(1)}</label>
          <input type="range" min={2} max={14} step={0.5} value={power}
            onChange={(e) => setPower(+e.target.value)} className="w-full" />
        </div>
        <button onClick={reset}
          className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400">
          Rack Again
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
        <p>Shots: {shots} &middot; Potted: {potted} &middot; Turn: <span className={currentPlayer === "player" ? "text-sky-400" : "text-rose-400"}>{currentPlayer === "player" ? "You" : "Computer"}</span></p>
        <p className="mt-0.5">
          You: <span className="text-slate-200">{playerType ?? "TBD"}</span>
          &ensp;Computer: <span className="text-slate-200">{computerType ?? "TBD"}</span>
        </p>
        {!gameOver && <p className="mt-1 text-slate-400">{message}</p>}
      </div>
    </div>
  );
}