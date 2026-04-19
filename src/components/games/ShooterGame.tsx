"use client";

import React, { useEffect, useRef, useState } from "react";

const STAGE_W = 320;
const STAGE_H = 320;
const PLAYER_W = 40;
const PLAYER_H = 16;
const BULLET_W = 4;
const BULLET_H = 10;
const ENEMY_SIZE = 24;

type Bullet = { x: number; y: number; fromEnemy?: boolean };
type Enemy = { id: number; x: number; y: number };

const spawnEnemies = (wave: number): Enemy[] => {
  const cols = 5, rows = Math.min(2 + Math.floor(wave / 2), 4);
  const out: Enemy[] = [];
  let id = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ id: id++, x: 30 + c * 56, y: 20 + r * 36 });
    }
  }
  return out;
};

export default function ShooterGame() {
  const [playerX, setPlayerX] = useState(STAGE_W / 2 - PLAYER_W / 2);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemyBullets, setEnemyBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>(() => spawnEnemies(1));
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("Arrows to move, space to shoot.");

  const playerRef = useRef(playerX);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemyBulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>(enemies);
  const keysRef = useRef({ left: false, right: false });
  const dirRef = useRef(1);
  const shootCooldownRef = useRef(0);

  useEffect(() => { playerRef.current = playerX; }, [playerX]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft") keysRef.current.left = true;
      if (e.key === "ArrowRight") keysRef.current.right = true;
      if (e.key === " " && shootCooldownRef.current <= 0 && !gameOver) {
        bulletsRef.current = [...bulletsRef.current, { x: playerRef.current + PLAYER_W / 2 - BULLET_W / 2, y: STAGE_H - 40 }];
        shootCooldownRef.current = 15;
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
  }, [gameOver]);

  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const step = () => {
      if (gameOver) { raf = requestAnimationFrame(step); return; }
      frame++;
      if (shootCooldownRef.current > 0) shootCooldownRef.current--;

      setPlayerX((x) => {
        let nx = x + (keysRef.current.right ? 4 : 0) - (keysRef.current.left ? 4 : 0);
        if (nx < 0) nx = 0;
        if (nx > STAGE_W - PLAYER_W) nx = STAGE_W - PLAYER_W;
        return nx;
      });

      bulletsRef.current = bulletsRef.current
        .map((b) => ({ ...b, y: b.y - 6 }))
        .filter((b) => b.y > -20);

      enemyBulletsRef.current = enemyBulletsRef.current
        .map((b) => ({ ...b, y: b.y + 3 }))
        .filter((b) => b.y < STAGE_H + 10);

      const currentEnemies = enemiesRef.current;
      if (currentEnemies.length) {
        const xs = currentEnemies.map((e) => e.x);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        let shift = dirRef.current * 0.6;
        let descend = 0;
        if (maxX + shift > STAGE_W - ENEMY_SIZE || minX + shift < 0) {
          dirRef.current *= -1;
          shift = 0;
          descend = 14;
        }
        enemiesRef.current = currentEnemies.map((e) => ({ ...e, x: e.x + shift, y: e.y + descend }));

        if (frame % 70 === 0 && enemiesRef.current.length) {
          const shooter = enemiesRef.current[Math.floor(Math.random() * enemiesRef.current.length)];
          enemyBulletsRef.current = [
            ...enemyBulletsRef.current,
            { x: shooter.x + ENEMY_SIZE / 2 - BULLET_W / 2, y: shooter.y + ENEMY_SIZE, fromEnemy: true },
          ];
        }
      }

      const remaining: Enemy[] = [];
      let killed = 0;
      for (const e of enemiesRef.current) {
        const hitIdx = bulletsRef.current.findIndex(
          (b) => b.x < e.x + ENEMY_SIZE && b.x + BULLET_W > e.x && b.y < e.y + ENEMY_SIZE && b.y + BULLET_H > e.y
        );
        if (hitIdx >= 0) {
          bulletsRef.current.splice(hitIdx, 1);
          killed++;
        } else {
          remaining.push(e);
        }
      }
      enemiesRef.current = remaining;
      if (killed) setScore((s) => s + killed * 10);

      const px = playerRef.current, py = STAGE_H - 30;
      const hitIdx = enemyBulletsRef.current.findIndex(
        (b) => b.x < px + PLAYER_W && b.x + BULLET_W > px && b.y < py + PLAYER_H && b.y + BULLET_H > py
      );
      if (hitIdx >= 0) {
        enemyBulletsRef.current.splice(hitIdx, 1);
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) { setGameOver(true); setMessage("Game over!"); }
          else setMessage("Hit! Lives remaining: " + nl);
          return Math.max(0, nl);
        });
      }

      if (enemiesRef.current.some((e) => e.y + ENEMY_SIZE >= py)) {
        setGameOver(true);
        setMessage("The aliens reached you!");
      }

      if (!enemiesRef.current.length) {
        const next = wave + 1;
        setWave(next);
        enemiesRef.current = spawnEnemies(next);
        dirRef.current = 1;
        setMessage(`Wave ${next}!`);
      }

      setBullets([...bulletsRef.current]);
      setEnemyBullets([...enemyBulletsRef.current]);
      setEnemies([...enemiesRef.current]);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [gameOver, wave]);

  const reset = () => {
    bulletsRef.current = [];
    enemyBulletsRef.current = [];
    enemiesRef.current = spawnEnemies(1);
    dirRef.current = 1;
    setBullets([]);
    setEnemyBullets([]);
    setEnemies(spawnEnemies(1));
    setScore(0);
    setLives(3);
    setWave(1);
    setGameOver(false);
    setMessage("New game!");
  };

  return (
    <div className="space-y-6 w-full max-w-2xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Top-Down Shooter</h2>
        <p className="mt-2 text-slate-400">Arrows move, space shoots. Clear waves, avoid enemy fire.</p>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-inner shadow-slate-950/40"
        style={{ width: STAGE_W, height: STAGE_H }}
      >
        {enemies.map((e) => (
          <div
            key={e.id}
            className="absolute rounded-lg bg-rose-500 shadow shadow-rose-500/30"
            style={{ left: e.x, top: e.y, width: ENEMY_SIZE, height: ENEMY_SIZE }}
          />
        ))}
        {bullets.map((b, i) => (
          <div key={"b" + i} className="absolute bg-cyan-300 rounded"
            style={{ left: b.x, top: b.y, width: BULLET_W, height: BULLET_H }} />
        ))}
        {enemyBullets.map((b, i) => (
          <div key={"eb" + i} className="absolute bg-yellow-400 rounded"
            style={{ left: b.x, top: b.y, width: BULLET_W, height: BULLET_H }} />
        ))}
        <div
          className="absolute rounded bg-emerald-400 shadow"
          style={{ left: playerX, top: STAGE_H - 30, width: PLAYER_W, height: PLAYER_H }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          <p>Score: {score}</p>
          <p>Wave: {wave}</p>
          <p>Lives: {lives}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300 col-span-1">
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