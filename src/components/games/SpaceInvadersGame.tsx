"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

const STAGE_W = 400;
const STAGE_H = 440;
const PLAYER_W = 36;
const PLAYER_H = 18;
const INVADER_W = 26;
const INVADER_H = 20;
const BULLET_W = 3;
const BULLET_H = 10;
const INVADER_COLS = 8;
const INVADER_ROWS = 4;

type Invader = { id: number; x: number; y: number; alive: boolean; row: number };
type Bullet = { x: number; y: number };

const spawnInvaders = (): Invader[] => {
  const out: Invader[] = [];
  let id = 0;
  for (let r = 0; r < INVADER_ROWS; r++) {
    for (let c = 0; c < INVADER_COLS; c++) {
      out.push({
        id: id++,
        x: 40 + c * 38,
        y: 40 + r * 32,
        alive: true,
        row: r,
      });
    }
  }
  return out;
};

const rowColor = (row: number) => ["#ef4444", "#f59e0b", "#10b981", "#a855f7"][row] || "#ffffff";
const rowPoints = (row: number) => [40, 30, 20, 10][row] || 10;

export default function SpaceInvadersGame() {
  const [playerX, setPlayerX] = useState(STAGE_W / 2 - PLAYER_W / 2);
  const [invaders, setInvaders] = useState<Invader[]>(spawnInvaders);
  const [playerBullets, setPlayerBullets] = useState<Bullet[]>([]);
  const [invaderBullets, setInvaderBullets] = useState<Bullet[]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [status, setStatus] = useState<"playing" | "gameover">("playing");
  const [message, setMessage] = useState("Arrows move, space fires.");

  const playerRef = useRef(playerX);
  const invadersRef = useRef(invaders);
  const pBulletsRef = useRef<Bullet[]>([]);
  const iBulletsRef = useRef<Bullet[]>([]);
  const keysRef = useRef({ left: false, right: false });
  const dirRef = useRef(1);
  const moveTimerRef = useRef(0);
  const shootCooldownRef = useRef(0);

  playerRef.current = playerX;
  invadersRef.current = invaders;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft") keysRef.current.left = true;
      if (e.key === "ArrowRight") keysRef.current.right = true;
      if (e.key === " " && shootCooldownRef.current <= 0 && status === "playing") {
        pBulletsRef.current = [
          ...pBulletsRef.current,
          { x: playerRef.current + PLAYER_W / 2 - BULLET_W / 2, y: STAGE_H - 50 },
        ];
        shootCooldownRef.current = 20;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keysRef.current.left = false;
      if (e.key === "ArrowRight") keysRef.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [status]);

  const reset = useCallback(() => {
    setPlayerX(STAGE_W / 2 - PLAYER_W / 2);
    setInvaders(spawnInvaders());
    setPlayerBullets([]);
    setInvaderBullets([]);
    pBulletsRef.current = [];
    iBulletsRef.current = [];
    dirRef.current = 1;
    setScore(0);
    setLives(3);
    setWave(1);
    setStatus("playing");
    setMessage("New game!");
  }, []);

  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const step = () => {
      if (status !== "playing") { raf = requestAnimationFrame(step); return; }
      frame++;
      if (shootCooldownRef.current > 0) shootCooldownRef.current--;

      setPlayerX((x) => {
        let nx = x + (keysRef.current.right ? 5 : 0) - (keysRef.current.left ? 5 : 0);
        if (nx < 10) nx = 10;
        if (nx > STAGE_W - PLAYER_W - 10) nx = STAGE_W - PLAYER_W - 10;
        return nx;
      });

      pBulletsRef.current = pBulletsRef.current
        .map((b) => ({ ...b, y: b.y - 8 }))
        .filter((b) => b.y > -20);

      iBulletsRef.current = iBulletsRef.current
        .map((b) => ({ ...b, y: b.y + 4 }))
        .filter((b) => b.y < STAGE_H + 20);

      const alive = invadersRef.current.filter((i) => i.alive);
      const aliveCount = alive.length;
      const speedFrames = Math.max(5, 30 - Math.floor((INVADER_COLS * INVADER_ROWS - aliveCount) / 3) - wave);
      moveTimerRef.current++;
      let moved = false;
      if (moveTimerRef.current >= speedFrames && aliveCount) {
        moveTimerRef.current = 0;
        moved = true;
        const xs = alive.map((i) => i.x);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        let shift = dirRef.current * 8;
        let descend = 0;
        if (maxX + shift > STAGE_W - INVADER_W - 10 || minX + shift < 10) {
          dirRef.current *= -1;
          shift = 0;
          descend = 16;
        }
        invadersRef.current = invadersRef.current.map((i) =>
          i.alive ? { ...i, x: i.x + shift, y: i.y + descend } : i
        );
      }

      if (frame % 40 === 0 && alive.length) {
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        iBulletsRef.current = [
          ...iBulletsRef.current,
          { x: shooter.x + INVADER_W / 2 - BULLET_W / 2, y: shooter.y + INVADER_H },
        ];
      }

      let killed = 0;
      let addedScore = 0;
      invadersRef.current = invadersRef.current.map((inv) => {
        if (!inv.alive) return inv;
        for (let i = 0; i < pBulletsRef.current.length; i++) {
          const b = pBulletsRef.current[i];
          if (b.x < inv.x + INVADER_W && b.x + BULLET_W > inv.x && b.y < inv.y + INVADER_H && b.y + BULLET_H > inv.y) {
            pBulletsRef.current.splice(i, 1);
            killed++;
            addedScore += rowPoints(inv.row);
            return { ...inv, alive: false };
          }
        }
        return inv;
      });
      if (killed) setScore((s) => s + addedScore);

      const py = STAGE_H - 40;
      for (let i = 0; i < iBulletsRef.current.length; i++) {
        const b = iBulletsRef.current[i];
        if (
          b.x < playerRef.current + PLAYER_W &&
          b.x + BULLET_W > playerRef.current &&
          b.y < py + PLAYER_H &&
          b.y + BULLET_H > py
        ) {
          iBulletsRef.current.splice(i, 1);
          setLives((l) => {
            const nl = l - 1;
            if (nl <= 0) {
              setStatus("gameover");
              setMessage("Game over!");
              setHighScore((hs) => Math.max(hs, score));
            } else {
              setMessage("Hit! Lives: " + nl);
            }
            return Math.max(0, nl);
          });
          break;
        }
      }

      if (invadersRef.current.some((i) => i.alive && i.y + INVADER_H >= py)) {
        setStatus("gameover");
        setMessage("Invaders reached you!");
        setHighScore((hs) => Math.max(hs, score));
      }

      if (!invadersRef.current.some((i) => i.alive)) {
        const nw = wave + 1;
        setWave(nw);
        invadersRef.current = spawnInvaders();
        dirRef.current = 1;
        iBulletsRef.current = [];
        setMessage(`Wave ${nw}!`);
      }

      setInvaders([...invadersRef.current]);
      setPlayerBullets([...pBulletsRef.current]);
      setInvaderBullets([...iBulletsRef.current]);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [status, wave, score]);

  return (
    <div className="space-y-6 w-full max-w-xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Space Invaders</h2>
        <p className="mt-2 text-slate-400">Arrow keys move, space fires. Survive the waves.</p>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 shadow-inner shadow-slate-950/40"
        style={{ width: STAGE_W, height: STAGE_H }}
      >
        {invaders.filter((i) => i.alive).map((i) => (
          <div
            key={i.id}
            className="absolute rounded-md"
            style={{
              left: i.x, top: i.y,
              width: INVADER_W, height: INVADER_H,
              background: rowColor(i.row),
              boxShadow: `0 0 6px ${rowColor(i.row)}80`,
            }}
          />
        ))}
        {playerBullets.map((b, i) => (
          <div key={"pb" + i} className="absolute bg-cyan-200"
            style={{ left: b.x, top: b.y, width: BULLET_W, height: BULLET_H }} />
        ))}
        {invaderBullets.map((b, i) => (
          <div key={"ib" + i} className="absolute bg-yellow-400"
            style={{ left: b.x, top: b.y, width: BULLET_W, height: BULLET_H }} />
        ))}
        <div
          className="absolute rounded-t-md bg-emerald-400"
          style={{ left: playerX, top: STAGE_H - 40, width: PLAYER_W, height: PLAYER_H }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          <p>Score: {score}</p>
          <p>High: {highScore}</p>
          <p>Wave: {wave}</p>
          <p>Lives: {lives}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
        <button
          onClick={reset}
          className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          New Game
        </button>
      </div>
    </div>
  );
}