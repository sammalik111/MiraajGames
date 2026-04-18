"use client";

import React, { useEffect, useRef, useState } from "react";

const initialEnemies = [
  { id: 1, x: 48, y: 24 },
  { id: 2, x: 136, y: 24 },
  { id: 3, x: 224, y: 24 },
];

export default function ShooterGame() {
  const [playerX, setPlayerX] = useState(160);
  const [bullets, setBullets] = useState<{ x: number; y: number }[]>([]);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Use arrow keys to move and space to shoot.");
  const [enemies, setEnemies] = useState(initialEnemies);
  const bulletsRef = useRef<{ x: number; y: number }[]>([]);
  const enemiesRef = useRef(initialEnemies);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        setPlayerX((current) => Math.max(current - 14, 20));
      }
      if (event.key === "ArrowRight") {
        setPlayerX((current) => Math.min(current + 14, 300));
      }
      if (event.key === " ") {
        const newBullet = { x: playerX + 12, y: 200 };
        bulletsRef.current = [...bulletsRef.current, newBullet];
        setBullets(bulletsRef.current);
        setMessage("Firing...");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerX]);

  useEffect(() => {
    const update = window.setInterval(() => {
      bulletsRef.current = bulletsRef.current
        .map((bullet) => ({ ...bullet, y: bullet.y - 10 }))
        .filter((bullet) => bullet.y > -10);

      const nextEnemies = enemiesRef.current.filter((enemy) => {
        const hit = bulletsRef.current.some(
          (bullet) => Math.abs(bullet.x - enemy.x) < 20 && Math.abs(bullet.y - enemy.y) < 22
        );

        if (hit) {
          setScore((value) => value + 1);
          setMessage("Target hit!");
        }

        return !hit;
      });

      enemiesRef.current = nextEnemies;
      setEnemies(nextEnemies);
      setBullets(bulletsRef.current);
    }, 80);

    return () => window.clearInterval(update);
  }, []);

  const enemyCount = enemies.length;

  return (
    <div className="space-y-6 w-full max-w-2xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Top-Down Shooter</h2>
        <p className="mt-2 text-slate-400">Move left and right, then press space to fire. Take down the alien squad.</p>
      </div>

      <div className="relative mx-auto h-64 w-[320px] overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 p-4 shadow-inner shadow-slate-950/40">
        {enemies.map((enemy) => (
          <div
            key={enemy.id}
            className="absolute h-9 w-9 rounded-full bg-rose-500 shadow-xl shadow-rose-500/30"
            style={{ left: enemy.x, top: enemy.y }}
          />
        ))}

        {bullets.map((bullet, index) => (
          <div
            key={`${bullet.x}-${index}`}
            className="absolute h-3 w-3 rounded-full bg-cyan-300"
            style={{ left: bullet.x, top: bullet.y }}
          />
        ))}

        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="h-10 w-28 rounded-2xl bg-slate-100/10 shadow-inner shadow-slate-950/40" style={{ left: playerX - 20 }} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          <p>Score: {score}</p>
          <p>Enemies left: {enemyCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      </div>
    </div>
  );
}
