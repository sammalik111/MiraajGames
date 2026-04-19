"use client";

import React, { useEffect, useRef, useState } from "react";

const VIEW_W = 640;
const VIEW_H = 480;
const WORLD_W = 2400;
const WORLD_H = 1440;
const PLAYER_SIZE = 24;
const BULLET_SIZE = 6;
const ENEMY_SIZE = 24;
const PLAYER_SPEED = 3;
const PLAYER_BULLET_SPEED = 2.4;
const ENEMY_BULLET_SPEED = 1.4;
const ENEMY_SPEED = 0.9;

type Bullet = { x: number; y: number; dx: number; dy: number; fromEnemy: boolean };
type Enemy = { id: number; x: number; y: number; dir: number; cooldown: number };
type Player = { x: number; y: number; vx: number; vy: number };
type Wall = { x: number; y: number; w: number; h: number };

const WALLS: Wall[] = [
  { x: 0, y: 0, w: WORLD_W, h: 20 },
  { x: 0, y: WORLD_H - 20, w: WORLD_W, h: 20 },
  { x: 0, y: 0, w: 20, h: WORLD_H },
  { x: WORLD_W - 20, y: 0, w: 20, h: WORLD_H },

  { x: 200, y: 120, w: 240, h: 20 },
  { x: 200, y: 120, w: 20, h: 120 },
  { x: 420, y: 120, w: 20, h: 120 },

  { x: 600, y: 260, w: 340, h: 20 },
  { x: 600, y: 260, w: 20, h: 160 },

  { x: 1000, y: 120, w: 20, h: 300 },
  { x: 1020, y: 400, w: 260, h: 20 },

  { x: 1400, y: 180, w: 240, h: 20 },
  { x: 1400, y: 180, w: 20, h: 240 },
  { x: 1620, y: 180, w: 20, h: 120 },

  { x: 1800, y: 80, w: 20, h: 400 },
  { x: 1800, y: 500, w: 400, h: 20 },

  { x: 300, y: 540, w: 400, h: 20 },
  { x: 700, y: 540, w: 20, h: 260 },
  { x: 300, y: 780, w: 420, h: 20 },

  { x: 880, y: 640, w: 300, h: 20 },
  { x: 880, y: 640, w: 20, h: 200 },
  { x: 1160, y: 640, w: 20, h: 300 },

  { x: 1320, y: 700, w: 300, h: 20 },
  { x: 1600, y: 700, w: 20, h: 240 },
  { x: 1320, y: 920, w: 320, h: 20 },

  { x: 100, y: 980, w: 500, h: 20 },
  { x: 100, y: 1200, w: 600, h: 20 },
  { x: 600, y: 1000, w: 20, h: 200 },

  { x: 800, y: 1060, w: 360, h: 20 },
  { x: 1160, y: 1060, w: 20, h: 260 },
  { x: 800, y: 1300, w: 380, h: 20 },

  { x: 1360, y: 1100, w: 400, h: 20 },
  { x: 1760, y: 1100, w: 20, h: 280 },
  { x: 1360, y: 1360, w: 420, h: 20 },
  { x: 1360, y: 1100, w: 20, h: 100 },

  { x: 1920, y: 640, w: 20, h: 420 },
  { x: 1920, y: 1040, w: 320, h: 20 },
];

const GOAL = { x: WORLD_W - 120, y: 80, w: 60, h: 60 };

const collides = (x: number, y: number, w: number, h: number) =>
  WALLS.some((wall) => x < wall.x + wall.w && x + w > wall.x && y < wall.y + wall.h && y + h > wall.y);

const clampToWorld = (x: number, y: number, w: number, h: number) => ({
  x: Math.max(0, Math.min(WORLD_W - w, x)),
  y: Math.max(0, Math.min(WORLD_H - h, y)),
});

const initialEnemies = (): Enemy[] => {
  const positions = [
    { x: 320, y: 180 }, { x: 780, y: 340 }, { x: 1120, y: 240 },
    { x: 1500, y: 320 }, { x: 1880, y: 380 },
    { x: 500, y: 640 }, { x: 1000, y: 760 }, { x: 1440, y: 820 },
    { x: 240, y: 1080 }, { x: 900, y: 1180 }, { x: 1540, y: 1220 },
    { x: 2080, y: 900 }, { x: 2080, y: 1220 },
  ];
  return positions.map((pos, i) => ({ id: i, ...pos, dir: i % 4, cooldown: 0 }));
};

const canSee = (enemy: Enemy, player: Player, visible: boolean) => {
  if (!visible) return false;
  const dx = player.x + PLAYER_SIZE / 2 - (enemy.x + ENEMY_SIZE / 2);
  const dy = player.y + PLAYER_SIZE / 2 - (enemy.y + ENEMY_SIZE / 2);
  const dist = Math.hypot(dx, dy);
  if (dist > 180) return false;
  const angle = Math.atan2(dy, dx);
  const enemyAngle = enemy.dir * Math.PI / 2;
  let diff = Math.abs(angle - enemyAngle);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff < Math.PI / 4;
};

export default function ShooterGame() {
  const spawn = { x: 60, y: WORLD_H - 80, vx: 0, vy: 0 };
  const [player, setPlayer] = useState<Player>(spawn);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>(initialEnemies);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [message, setMessage] = useState("Arrows to move, space to shoot. Stand still to stay invisible.");
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);

  const keysRef = useRef({ left: false, right: false, up: false, down: false });
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>(initialEnemies());
  const playerRef = useRef<Player>(player);
  const shotCooldown = useRef(0);

  useEffect(() => { playerRef.current = player; }, [player]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft") keysRef.current.left = true;
      if (event.key === "ArrowRight") keysRef.current.right = true;
      if (event.key === "ArrowUp") keysRef.current.up = true;
      if (event.key === "ArrowDown") keysRef.current.down = true;
      if (event.key === " " && shotCooldown.current <= 0 && !gameOver && !victory) {
        const p = playerRef.current;
        const dir = { dx: 0, dy: -1 };
        if (keysRef.current.left) { dir.dx = -1; dir.dy = 0; }
        else if (keysRef.current.right) { dir.dx = 1; dir.dy = 0; }
        else if (keysRef.current.down) { dir.dx = 0; dir.dy = 1; }
        else if (keysRef.current.up) { dir.dx = 0; dir.dy = -1; }
        bulletsRef.current = [
          ...bulletsRef.current,
          {
            x: p.x + PLAYER_SIZE / 2 - BULLET_SIZE / 2,
            y: p.y + PLAYER_SIZE / 2 - BULLET_SIZE / 2,
            dx: dir.dx * PLAYER_BULLET_SPEED,
            dy: dir.dy * PLAYER_BULLET_SPEED,
            fromEnemy: false,
          },
        ];
        setBullets(bulletsRef.current);
        shotCooldown.current = 20;
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") keysRef.current.left = false;
      if (event.key === "ArrowRight") keysRef.current.right = false;
      if (event.key === "ArrowUp") keysRef.current.up = false;
      if (event.key === "ArrowDown") keysRef.current.down = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [gameOver, victory]);

  useEffect(() => {
    let animation: number;
    const step = () => {
      if (gameOver || victory) {
        animation = requestAnimationFrame(step);
        return;
      }

      const nextPlayer = { ...playerRef.current };
      nextPlayer.vx = 0;
      nextPlayer.vy = 0;
      if (keysRef.current.left) nextPlayer.vx -= PLAYER_SPEED;
      if (keysRef.current.right) nextPlayer.vx += PLAYER_SPEED;
      if (keysRef.current.up) nextPlayer.vy -= PLAYER_SPEED;
      if (keysRef.current.down) nextPlayer.vy += PLAYER_SPEED;

      const tryX = nextPlayer.x + nextPlayer.vx;
      if (!collides(tryX, nextPlayer.y, PLAYER_SIZE, PLAYER_SIZE)) {
        nextPlayer.x = Math.max(0, Math.min(WORLD_W - PLAYER_SIZE, tryX));
      }
      const tryY = nextPlayer.y + nextPlayer.vy;
      if (!collides(nextPlayer.x, tryY, PLAYER_SIZE, PLAYER_SIZE)) {
        nextPlayer.y = Math.max(0, Math.min(WORLD_H - PLAYER_SIZE, tryY));
      }

      const isMoving = nextPlayer.vx !== 0 || nextPlayer.vy !== 0;

      if (shotCooldown.current > 0) shotCooldown.current -= 1;

      let nextBullets = bulletsRef.current
        .map((b) => ({ ...b, x: b.x + b.dx, y: b.y + b.dy }))
        .filter((b) =>
          b.x > -20 && b.x < WORLD_W + 20 && b.y > -20 && b.y < WORLD_H + 20 &&
          !collides(b.x, b.y, BULLET_SIZE, BULLET_SIZE)
        );

      const movedEnemies = enemiesRef.current.map((enemy) => {
        let { x, y, dir } = enemy;
        let nx = x, ny = y;
        if (dir === 0) nx = x + ENEMY_SPEED;
        else if (dir === 1) ny = y + ENEMY_SPEED;
        else if (dir === 2) nx = x - ENEMY_SPEED;
        else if (dir === 3) ny = y - ENEMY_SPEED;

        const outOfBounds = nx < 20 || nx > WORLD_W - ENEMY_SIZE - 20 || ny < 20 || ny > WORLD_H - ENEMY_SIZE - 20;
        if (outOfBounds || collides(nx, ny, ENEMY_SIZE, ENEMY_SIZE)) {
          dir = (dir + 1) % 4;
        } else {
          x = nx;
          y = ny;
        }
        const clamped = clampToWorld(x, y, ENEMY_SIZE, ENEMY_SIZE);
        return { ...enemy, x: clamped.x, y: clamped.y, dir, cooldown: Math.max(0, enemy.cooldown - 1) };
      });

      let points = 0;
      let nextMessage = message;
      const aliveEnemies: Enemy[] = [];
      for (const enemy of movedEnemies) {
        const hitIndex = nextBullets.findIndex(
          (b) => !b.fromEnemy &&
            b.x < enemy.x + ENEMY_SIZE && b.x + BULLET_SIZE > enemy.x &&
            b.y < enemy.y + ENEMY_SIZE && b.y + BULLET_SIZE > enemy.y
        );
        if (hitIndex >= 0) {
          nextBullets.splice(hitIndex, 1);
          points += 10;
          nextMessage = "Enemy down!";
        } else {
          aliveEnemies.push(enemy);
        }
      }
      if (points > 0) setScore((prev) => prev + points);
      if (aliveEnemies.length === 0) {
        setVictory(true);
        nextMessage = "All enemies cleared — mission success!";
      }

      const firingEnemies = aliveEnemies.map((enemy) => {
        if (canSee(enemy, nextPlayer, isMoving) && enemy.cooldown <= 0 && Math.random() < 0.03) {
          const ex = enemy.x + ENEMY_SIZE / 2 - BULLET_SIZE / 2;
          const ey = enemy.y + ENEMY_SIZE / 2 - BULLET_SIZE / 2;
          const tx = nextPlayer.x + PLAYER_SIZE / 2 - (enemy.x + ENEMY_SIZE / 2);
          const ty = nextPlayer.y + PLAYER_SIZE / 2 - (enemy.y + ENEMY_SIZE / 2);
          const d = Math.hypot(tx, ty) || 1;
          nextBullets.push({
            x: ex,
            y: ey,
            dx: (tx / d) * ENEMY_BULLET_SPEED,
            dy: (ty / d) * ENEMY_BULLET_SPEED,
            fromEnemy: true,
          });
          return { ...enemy, cooldown: 50 };
        }
        return enemy;
      });

      const hitByEnemy = nextBullets.some((b) =>
        b.fromEnemy &&
        b.x < nextPlayer.x + PLAYER_SIZE && b.x + BULLET_SIZE > nextPlayer.x &&
        b.y < nextPlayer.y + PLAYER_SIZE && b.y + BULLET_SIZE > nextPlayer.y
      );
      if (hitByEnemy) {
        nextBullets = nextBullets.filter((b) =>
          !(b.fromEnemy &&
            b.x < nextPlayer.x + PLAYER_SIZE && b.x + BULLET_SIZE > nextPlayer.x &&
            b.y < nextPlayer.y + PLAYER_SIZE && b.y + BULLET_SIZE > nextPlayer.y)
        );
        setLives((prev) => {
          const nl = prev - 1;
          if (nl <= 0) { setGameOver(true); setMessage("You were hit — game over."); }
          else setMessage("Hit! Stay still to stay hidden.");
          return Math.max(0, nl);
        });
      }

      if (nextPlayer.x < GOAL.x + GOAL.w && nextPlayer.x + PLAYER_SIZE > GOAL.x &&
          nextPlayer.y < GOAL.y + GOAL.h && nextPlayer.y + PLAYER_SIZE > GOAL.y) {
        setVictory(true);
        nextMessage = "You reached the goal!";
      }

      if (nextMessage !== message) setMessage(nextMessage);

      setPlayer(nextPlayer);
      setBullets(nextBullets);
      setEnemies(firingEnemies);
      bulletsRef.current = nextBullets;
      enemiesRef.current = firingEnemies;
      playerRef.current = nextPlayer;
      animation = requestAnimationFrame(step);
    };
    animation = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animation);
  }, [gameOver, victory, message]);

  const reset = () => {
    setPlayer(spawn);
    playerRef.current = spawn;
    const fresh = initialEnemies();
    setEnemies(fresh);
    enemiesRef.current = fresh;
    setBullets([]);
    bulletsRef.current = [];
    setScore(0);
    setLives(3);
    setGameOver(false);
    setVictory(false);
    setMessage("Arrows to move, space to shoot. Stand still to stay invisible.");
  };

  const camX = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x + PLAYER_SIZE / 2 - VIEW_W / 2));
  const camY = Math.max(0, Math.min(WORLD_H - VIEW_H, player.y + PLAYER_SIZE / 2 - VIEW_H / 2));
  const isMoving = player.vx !== 0 || player.vy !== 0;
  const playerOpacity = isMoving ? 1 : 0.25;

  return (
    <div className="space-y-6 w-full max-w-3xl px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/20">
        <h2 className="text-2xl font-semibold text-white">Arcade Shooter</h2>
        <p className="mt-2 text-slate-400">
          Big world — camera follows you. Stand still and you turn invisible; enemies can&apos;t see you. Reach the gold zone or clear all enemies.
        </p>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-inner shadow-slate-950/40"
        style={{ width: VIEW_W, height: VIEW_H }}
      >
        <div
          className="absolute will-change-transform"
          style={{
            width: WORLD_W,
            height: WORLD_H,
            transform: `translate(${-camX}px, ${-camY}px)`,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div
            className="absolute rounded-lg bg-yellow-400/80 shadow-lg shadow-yellow-500/40 ring-2 ring-yellow-200"
            style={{ left: GOAL.x, top: GOAL.y, width: GOAL.w, height: GOAL.h }}
          />

          {WALLS.map((wall, i) => (
            <div
              key={i}
              className="absolute rounded-sm bg-slate-600 shadow-inner shadow-slate-900"
              style={{ left: wall.x, top: wall.y, width: wall.w, height: wall.h }}
            />
          ))}

          <svg className="absolute inset-0 pointer-events-none" width={WORLD_W} height={WORLD_H}>
            {enemies.map((enemy) => {
              const ex = enemy.x + ENEMY_SIZE / 2;
              const ey = enemy.y + ENEMY_SIZE / 2;
              const a = enemy.dir * Math.PI / 2;
              const d = 180;
              const la = a - Math.PI / 4, ra = a + Math.PI / 4;
              return (
                <g key={`sight-${enemy.id}`}>
                  <path
                    d={`M ${ex} ${ey} L ${ex + Math.cos(la) * d} ${ey + Math.sin(la) * d} A ${d} ${d} 0 0 1 ${ex + Math.cos(ra) * d} ${ey + Math.sin(ra) * d} Z`}
                    fill="rgba(239,68,68,0.08)"
                    stroke="rgba(239,68,68,0.35)"
                    strokeWidth={1}
                  />
                </g>
              );
            })}
          </svg>

          {enemies.map((enemy) => (
            <div
              key={enemy.id}
              className="absolute rounded-full bg-rose-500 shadow-xl shadow-rose-500/30"
              style={{ left: enemy.x, top: enemy.y, width: ENEMY_SIZE, height: ENEMY_SIZE }}
            />
          ))}

          {bullets.map((b, idx) => (
            <div
              key={idx}
              className={`absolute rounded-full ${b.fromEnemy ? "bg-orange-400" : "bg-cyan-300"}`}
              style={{ left: b.x, top: b.y, width: BULLET_SIZE, height: BULLET_SIZE }}
            />
          ))}

          <div
            className="absolute rounded-full bg-cyan-400 shadow-2xl shadow-cyan-500/30 transition-opacity duration-150"
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
              opacity: playerOpacity,
            }}
          />
        </div>

        <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-slate-950/70 px-2 py-1 text-[10px] font-medium text-slate-300">
          {isMoving ? "VISIBLE" : "STEALTH"}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          <p>Score: {score}</p>
          <p>Lives: {lives}</p>
          <p>{victory ? "Victory!" : gameOver ? "Defeat" : "Battle in progress"}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
        <button
          onClick={reset}
          className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          Restart
        </button>
      </div>
    </div>
  );
}
