"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────────────

const VIEW_W = 640;
const VIEW_H = 480;
const WORLD_W = 2400;
const WORLD_H = 1440;
const PLAYER_SPEED = 3;
const PLAYER_BULLET_SPEED = 2.4;
const ENEMY_BULLET_SPEED = 1.4;
const PLAYER_SIZE = 20;
const ENEMY_SIZE = 22;
const BULLET_R = 4;
const SIGHT_RANGE = 300;
const SIGHT_ANGLE = Math.PI / 3; // ±60°
const PROXIMITY_DETECT = 80;     // always detected within this range unless stealth
const ENEMY_SHOOT_COOLDOWN = 80; // frames

// ── Level enemy configs ────────────────────────────────────────────────────

interface EnemySpawn {
  x: number;
  y: number;
  dir: number; // radians patrol direction
}

const LEVEL_ENEMIES: EnemySpawn[][] = [
  // Level 1: 8 enemies
  [
    { x: 400,  y: 200,  dir: 0 },
    { x: 800,  y: 400,  dir: Math.PI },
    { x: 1200, y: 300,  dir: Math.PI / 2 },
    { x: 600,  y: 700,  dir: -Math.PI / 2 },
    { x: 1600, y: 200,  dir: Math.PI },
    { x: 1000, y: 900,  dir: 0 },
    { x: 1800, y: 600,  dir: Math.PI / 2 },
    { x: 2000, y: 1100, dir: 0 },
  ],
  // Level 2: 14 enemies
  [
    { x: 300,  y: 200,  dir: 0 },
    { x: 700,  y: 350,  dir: Math.PI },
    { x: 1100, y: 200,  dir: Math.PI / 2 },
    { x: 500,  y: 600,  dir: -Math.PI / 2 },
    { x: 1400, y: 400,  dir: Math.PI },
    { x: 900,  y: 800,  dir: 0 },
    { x: 1700, y: 500,  dir: Math.PI / 2 },
    { x: 2100, y: 900,  dir: -Math.PI / 2 },
    { x: 350,  y: 1000, dir: 0 },
    { x: 1300, y: 1100, dir: Math.PI },
    { x: 1900, y: 300,  dir: 0 },
    { x: 600,  y: 1200, dir: Math.PI / 2 },
    { x: 2200, y: 700,  dir: -Math.PI / 2 },
    { x: 1500, y: 1300, dir: 0 },
  ],
  // Level 3: 20 enemies
  [
    { x: 300,  y: 150,  dir: 0 },
    { x: 650,  y: 300,  dir: Math.PI },
    { x: 1050, y: 180,  dir: Math.PI / 2 },
    { x: 450,  y: 550,  dir: -Math.PI / 2 },
    { x: 1350, y: 350,  dir: Math.PI },
    { x: 850,  y: 750,  dir: 0 },
    { x: 1650, y: 480,  dir: Math.PI / 2 },
    { x: 2050, y: 850,  dir: -Math.PI / 2 },
    { x: 320,  y: 950,  dir: 0 },
    { x: 1250, y: 1050, dir: Math.PI },
    { x: 1850, y: 280,  dir: 0 },
    { x: 580,  y: 1150, dir: Math.PI / 2 },
    { x: 2150, y: 680,  dir: -Math.PI / 2 },
    { x: 1480, y: 1250, dir: 0 },
    { x: 750,  y: 1350, dir: Math.PI },
    { x: 1950, y: 1100, dir: 0 },
    { x: 2300, y: 400,  dir: -Math.PI / 2 },
    { x: 1100, y: 1350, dir: Math.PI / 2 },
    { x: 2200, y: 1300, dir: 0 },
    { x: 400,  y: 1350, dir: Math.PI },
  ],
];

// ── Types ──────────────────────────────────────────────────────────────────

interface Player {
  x: number; y: number;
  vx: number; vy: number;
  shootCooldown: number;
}

interface Enemy {
  id: number;
  x: number; y: number;
  dir: number; // patrol direction in radians
  speed: number;
  alive: boolean;
  shootCooldown: number;
  alerted: boolean;
}

interface Bullet {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  fromPlayer: boolean;
}

interface World {
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  score: number;
  lives: number;
  level: number; // 1-based
  idCounter: number;
  phase: "playing" | "levelComplete" | "gameOver" | "win";
  stealthTicks: number; // ticks player has been still
}

// ── World obstacles (static rects) ────────────────────────────────────────

interface Rect { x: number; y: number; w: number; h: number }
// Tight corridor layout — walls form rooms and choke-points
const OBSTACLES: Rect[] = [
  // ── Top horizontal walls ──
  { x: 200,  y: 80,   w: 400, h: 40 },
  { x: 800,  y: 80,   w: 300, h: 40 },
  { x: 1300, y: 80,   w: 400, h: 40 },
  { x: 1900, y: 80,   w: 350, h: 40 },

  // ── Left block + corridor ──
  { x: 80,   y: 200,  w: 40,  h: 500 },
  { x: 80,   y: 820,  w: 40,  h: 300 },

  // ── Room 1 (upper-left) ──
  { x: 200,  y: 200,  w: 300, h: 40 },
  { x: 200,  y: 200,  w: 40,  h: 280 },
  { x: 200,  y: 440,  w: 200, h: 40 },

  // ── Vertical divider 1 ──
  { x: 560,  y: 160,  w: 40,  h: 360 },
  { x: 560,  y: 620,  w: 40,  h: 200 },

  // ── Room 2 (upper-mid) ──
  { x: 680,  y: 200,  w: 320, h: 40 },
  { x: 680,  y: 200,  w: 40,  h: 260 },
  { x: 860,  y: 380,  w: 140, h: 40 },

  // ── Vertical divider 2 ──
  { x: 1060, y: 80,   w: 40,  h: 300 },
  { x: 1060, y: 480,  w: 40,  h: 280 },

  // ── Room 3 (upper-right) ──
  { x: 1160, y: 200,  w: 300, h: 40 },
  { x: 1380, y: 200,  w: 40,  h: 300 },
  { x: 1160, y: 460,  w: 180, h: 40 },

  // ── Vertical divider 3 ──
  { x: 1560, y: 160,  w: 40,  h: 360 },
  { x: 1560, y: 620,  w: 40,  h: 200 },

  // ── Room 4 (far right) ──
  { x: 1680, y: 200,  w: 320, h: 40 },
  { x: 1680, y: 200,  w: 40,  h: 280 },
  { x: 1880, y: 340,  w: 120, h: 40 },

  // ── Mid horizontal wall ──
  { x: 160,  y: 760,  w: 300, h: 40 },
  { x: 600,  y: 720,  w: 240, h: 40 },
  { x: 980,  y: 760,  w: 280, h: 40 },
  { x: 1400, y: 720,  w: 240, h: 40 },
  { x: 1760, y: 760,  w: 320, h: 40 },

  // ── Lower rooms ──
  { x: 200,  y: 900,  w: 40,  h: 300 },
  { x: 200,  y: 900,  w: 300, h: 40 },
  { x: 440,  y: 1060, w: 40,  h: 180 },

  { x: 680,  y: 860,  w: 280, h: 40 },
  { x: 880,  y: 860,  w: 40,  h: 280 },
  { x: 680,  y: 1100, w: 160, h: 40 },

  { x: 1080, y: 900,  w: 40,  h: 280 },
  { x: 1080, y: 900,  w: 260, h: 40 },
  { x: 1280, y: 1060, w: 40,  h: 180 },

  { x: 1440, y: 860,  w: 280, h: 40 },
  { x: 1440, y: 860,  w: 40,  h: 280 },
  { x: 1560, y: 1080, w: 160, h: 40 },

  { x: 1800, y: 900,  w: 40,  h: 300 },
  { x: 1800, y: 900,  w: 280, h: 40 },
  { x: 2000, y: 1060, w: 40,  h: 180 },

  // ── Bottom wall ──
  { x: 160,  y: 1300, w: 400, h: 40 },
  { x: 720,  y: 1320, w: 300, h: 40 },
  { x: 1160, y: 1300, w: 360, h: 40 },
  { x: 1680, y: 1320, w: 340, h: 40 },

  // ── Right border ──
  { x: 2280, y: 200,  w: 40,  h: 500 },
  { x: 2280, y: 820,  w: 40,  h: 360 },
];

function rectsOverlap(ax: number, ay: number, ar: number, rect: Rect): boolean {
  return ax + ar > rect.x && ax - ar < rect.x + rect.w &&
    ay + ar > rect.y && ay - ar < rect.y + rect.h;
}

function clampToWorld(x: number, y: number, r: number): [number, number] {
  return [
    Math.max(r, Math.min(WORLD_W - r, x)),
    Math.max(r, Math.min(WORLD_H - r, y)),
  ];
}

function isInsideObstacle(x: number, y: number, r: number): boolean {
  return OBSTACLES.some(rect => rectsOverlap(x, y, r, rect));
}

function findSafeSpawnPos(x: number, y: number): [number, number] {
  const pad = ENEMY_SIZE / 2 + 6;
  if (!isInsideObstacle(x, y, pad)) return [x, y];
  for (let radius = 50; radius <= 500; radius += 50) {
    for (let step = 0; step < 16; step++) {
      const angle = (step / 16) * Math.PI * 2;
      const [cx, cy] = clampToWorld(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, pad);
      if (!isInsideObstacle(cx, cy, pad)) return [cx, cy];
    }
  }
  return [x, y];
}

function buildWorld(levelIdx: number, prevScore: number, prevLives: number): World {
  const spawns = LEVEL_ENEMIES[levelIdx];
  const enemies: Enemy[] = spawns.map((s, i) => {
    const [sx, sy] = findSafeSpawnPos(s.x, s.y);
    return {
      id: i,
      x: sx, y: sy,
      dir: s.dir,
      speed: 1.2 + levelIdx * 0.3,
      alive: true,
      shootCooldown: Math.floor(Math.random() * ENEMY_SHOOT_COOLDOWN),
      alerted: false,
    };
  });
  return {
    player: { x: 120, y: 120, vx: 0, vy: 0, shootCooldown: 0 },
    enemies,
    bullets: [],
    score: prevScore,
    lives: prevLives,
    level: levelIdx + 1,
    idCounter: 1000,
    phase: "playing",
    stealthTicks: 0,
  };
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

// ── Component ──────────────────────────────────────────────────────────────

export default function ShooterGame() {
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(3);
  const [uiLevel, setUiLevel] = useState(1);
  const [uiStealth, setUiStealth] = useState(true);
  const [phase, setPhase] = useState<"playing" | "levelComplete" | "gameOver" | "win">("playing");
  const [levelMsg, setLevelMsg] = useState("");

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const worldRef    = useRef<World>(buildWorld(0, 0, 3));
  const keysRef     = useRef<Set<string>>(new Set());
  const rafRef      = useRef<number>(0);
  const phaseRef    = useRef<"playing" | "levelComplete" | "gameOver" | "win">("playing");
  const canShootRef = useRef(true);
  const mousePosRef = useRef({ x: VIEW_W / 2, y: VIEW_H / 2 });

  phaseRef.current = phase;

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = worldRef.current;
    const p = w.player;

    // Camera
    const camX = Math.max(0, Math.min(WORLD_W - VIEW_W, p.x - VIEW_W / 2));
    const camY = Math.max(0, Math.min(WORLD_H - VIEW_H, p.y - VIEW_H / 2));

    // Background
    ctx.fillStyle = "#1a2e1a";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Grid
    ctx.strokeStyle = "#1e3a1e";
    ctx.lineWidth = 1;
    const gSize = 60;
    for (let gx = Math.floor(camX / gSize) * gSize; gx < camX + VIEW_W; gx += gSize) {
      ctx.beginPath(); ctx.moveTo(gx - camX, 0); ctx.lineTo(gx - camX, VIEW_H); ctx.stroke();
    }
    for (let gy = Math.floor(camY / gSize) * gSize; gy < camY + VIEW_H; gy += gSize) {
      ctx.beginPath(); ctx.moveTo(0, gy - camY); ctx.lineTo(VIEW_W, gy - camY); ctx.stroke();
    }

    // Obstacles
    OBSTACLES.forEach((rect) => {
      const rx = rect.x - camX; const ry = rect.y - camY;
      ctx.fillStyle = "#374151";
      ctx.fillRect(rx, ry, rect.w, rect.h);
      ctx.strokeStyle = "#4b5563"; ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rect.w, rect.h);
    });

    // Goal marker (bottom-right quadrant)
    const goalX = WORLD_W - 200 - camX;
    const goalY = WORLD_H - 200 - camY;
    ctx.fillStyle = "rgba(34,197,94,0.2)";
    ctx.fillRect(goalX, goalY, 120, 120);
    ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 3;
    ctx.strokeRect(goalX, goalY, 120, 120);
    ctx.fillStyle = "#22c55e"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("GOAL", goalX + 60, goalY + 65);

    // Enemies
    w.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const ex = enemy.x - camX; const ey = enemy.y - camY;
      if (ex < -ENEMY_SIZE || ex > VIEW_W + ENEMY_SIZE || ey < -ENEMY_SIZE || ey > VIEW_H + ENEMY_SIZE) return;

      // Sight cone
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = enemy.alerted ? "#ef4444" : "#fde047";
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.arc(ex, ey, SIGHT_RANGE, enemy.dir - SIGHT_ANGLE, enemy.dir + SIGHT_ANGLE);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // Body
      ctx.fillStyle = enemy.alerted ? "#ef4444" : "#f59e0b";
      ctx.beginPath(); ctx.arc(ex, ey, ENEMY_SIZE / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
      ctx.stroke();
      // Direction indicator
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(enemy.dir) * 12, ey + Math.sin(enemy.dir) * 12);
      ctx.stroke();
    });

    // Bullets
    w.bullets.forEach((b) => {
      const bx = b.x - camX; const by = b.y - camY;
      ctx.fillStyle = b.fromPlayer ? "#60a5fa" : "#f87171";
      ctx.beginPath(); ctx.arc(bx, by, BULLET_R, 0, Math.PI * 2); ctx.fill();
    });

    // Player
    const px = p.x - camX; const py = p.y - camY;
    const isMoving = p.vx !== 0 || p.vy !== 0;
    const isStealth = !isMoving && w.stealthTicks > 10;
    ctx.save();
    ctx.globalAlpha = isStealth ? 0.25 : 1;
    ctx.fillStyle = "#60a5fa";
    ctx.beginPath(); ctx.arc(px, py, PLAYER_SIZE / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#93c5fd"; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // Aim line + crosshair toward mouse cursor
    const mx = mousePosRef.current.x; const my = mousePosRef.current.y;
    if (!isStealth) {
      ctx.strokeStyle = "rgba(147,197,253,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(mx, my); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(147,197,253,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(mx - 7, my); ctx.lineTo(mx + 7, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my - 7); ctx.lineTo(mx, my + 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.stroke();
    }

    // Minimap
    const mmW = 120; const mmH = 72;
    const mmX = VIEW_W - mmW - 8; const mmY = 8;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeStyle = "#4b5563"; ctx.lineWidth = 1;
    ctx.strokeRect(mmX, mmY, mmW, mmH);
    // Enemies on minimap
    w.enemies.forEach((e) => {
      if (!e.alive) return;
      ctx.fillStyle = e.alerted ? "#ef4444" : "#f59e0b";
      ctx.fillRect(mmX + (e.x / WORLD_W) * mmW - 1.5, mmY + (e.y / WORLD_H) * mmH - 1.5, 3, 3);
    });
    // Player on minimap
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(mmX + (p.x / WORLD_W) * mmW - 2.5, mmY + (p.y / WORLD_H) * mmH - 2.5, 5, 5);
  }, []);

  const tick = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const w = worldRef.current;
    const p = w.player;
    const keys = keysRef.current;

    // Player movement
    let moved = false;
    p.vx = 0; p.vy = 0;
    if (keys.has("ArrowLeft"))  { p.vx = -PLAYER_SPEED; moved = true; }
    if (keys.has("ArrowRight")) { p.vx =  PLAYER_SPEED; moved = true; }
    if (keys.has("ArrowUp"))    { p.vy = -PLAYER_SPEED; moved = true; }
    if (keys.has("ArrowDown"))  { p.vy =  PLAYER_SPEED; moved = true; }

    if (moved) {
      w.stealthTicks = 0;
      let nx = p.x + p.vx; let ny = p.y + p.vy;
      [nx, ny] = clampToWorld(nx, ny, PLAYER_SIZE / 2);
      // Obstacle collision
      let blocked = false;
      OBSTACLES.forEach((rect) => { if (rectsOverlap(nx, ny, PLAYER_SIZE / 2, rect)) blocked = true; });
      if (!blocked) { p.x = nx; p.y = ny; }
    } else {
      w.stealthTicks++;
    }

    // Player shoot (aim toward mouse cursor in world space)
    const isStealth = !moved && w.stealthTicks > 10;
    if (keys.has(" ") && canShootRef.current && !isStealth) {
      canShootRef.current = false;
      const camX = Math.max(0, Math.min(WORLD_W - VIEW_W, p.x - VIEW_W / 2));
      const camY = Math.max(0, Math.min(WORLD_H - VIEW_H, p.y - VIEW_H / 2));
      const mwx = mousePosRef.current.x + camX;
      const mwy = mousePosRef.current.y + camY;
      const bdx = mwx - p.x; const bdy = mwy - p.y;
      const bd  = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
      w.bullets.push({ id: w.idCounter++, x: p.x, y: p.y, vx: (bdx / bd) * PLAYER_BULLET_SPEED, vy: (bdy / bd) * PLAYER_BULLET_SPEED, fromPlayer: true });
      setTimeout(() => { canShootRef.current = true; }, 350);
    }

    setUiStealth(isStealth);

    // Move enemies
    w.enemies.forEach((enemy) => {
      if (!enemy.alive) return;

      // Check sight to player
      const dx = p.x - enemy.x; const dy = p.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angleToPlayer = Math.atan2(dy, dx);
      const angleDiff = Math.abs(((angleToPlayer - enemy.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const inCone = dist < SIGHT_RANGE && angleDiff < SIGHT_ANGLE;
      const canSeePlayer = !isStealth && (dist < PROXIMITY_DETECT || inCone);

      enemy.alerted = canSeePlayer;

      // Cooldown ticks every frame regardless
      if (enemy.shootCooldown > 0) enemy.shootCooldown--;

      // Shoot
      if (canSeePlayer) {
        if (enemy.shootCooldown <= 0) {
          const speed = ENEMY_BULLET_SPEED;
          const vx = (dx / dist) * speed; const vy = (dy / dist) * speed;
          w.bullets.push({ id: w.idCounter++, x: enemy.x, y: enemy.y, vx, vy, fromPlayer: false });
          enemy.shootCooldown = ENEMY_SHOOT_COOLDOWN;
        }
        // Face player
        enemy.dir = angleToPlayer;
      }

      // Patrol
      const speed = canSeePlayer ? enemy.speed * 0.8 : enemy.speed;
      let nx = enemy.x + Math.cos(enemy.dir) * speed;
      let ny = enemy.y + Math.sin(enemy.dir) * speed;
      [nx, ny] = clampToWorld(nx, ny, ENEMY_SIZE / 2);

      // Reverse at world edge or obstacle
      let blocked = nx === enemy.x || ny === enemy.y;
      OBSTACLES.forEach((rect) => { if (rectsOverlap(nx, ny, ENEMY_SIZE / 2, rect)) blocked = true; });
      if (blocked) {
        enemy.dir = enemy.dir + Math.PI + (Math.random() - 0.5) * 0.5;
      } else {
        enemy.x = nx; enemy.y = ny;
      }
    });

    // Move bullets
    w.bullets = w.bullets.filter((b) => {
      b.x += b.vx; b.y += b.vy;
      if (b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) return false;
      for (const rect of OBSTACLES) { if (rectsOverlap(b.x, b.y, BULLET_R, rect)) return false; }
      return true;
    });

    // Bullet vs enemies
    w.bullets = w.bullets.filter((b) => {
      if (!b.fromPlayer) return true;
      for (const enemy of w.enemies) {
        if (!enemy.alive) continue;
        const dx = b.x - enemy.x; const dy = b.y - enemy.y;
        if (Math.sqrt(dx * dx + dy * dy) < BULLET_R + ENEMY_SIZE / 2) {
          enemy.alive = false;
          w.score += 50;
          setUiScore(w.score);
          return false;
        }
      }
      return true;
    });

    // Enemy bullets vs player
    w.bullets = w.bullets.filter((b) => {
      if (b.fromPlayer) return true;
      const dx = b.x - p.x; const dy = b.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < BULLET_R + PLAYER_SIZE / 2) {
        w.lives--;
        setUiLives(w.lives);
        if (w.lives <= 0) setPhase("gameOver");
        return false;
      }
      return true;
    });

    // Check level clear: all enemies dead OR player reached goal
    const allDead = w.enemies.every((e) => !e.alive);
    const atGoal = p.x > WORLD_W - 320 && p.y > WORLD_H - 320;
    if (allDead || atGoal) {
      w.score += 200;
      setUiScore(w.score);
      if (w.level >= LEVEL_ENEMIES.length) {
        setPhase("win");
      } else {
        const msg = `Level ${w.level} Complete! +200 pts`;
        setLevelMsg(msg);
        setPhase("levelComplete");
        const nextIdx = w.level; // 0-based
        const savedScore = w.score; const savedLives = w.lives;
        setTimeout(() => {
          worldRef.current = buildWorld(nextIdx, savedScore, savedLives);
          setUiLevel(nextIdx + 1);
          setUiScore(savedScore); setUiLives(savedLives);
          canShootRef.current = true;
          setPhase("playing");
        }, 2000);
      }
    }

    drawFrame();
  }, [drawFrame]);

  // RAF loop
  useEffect(() => {
    const loop = () => { tick(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  // Keys
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
    };
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  useEffect(() => { drawFrame(); }, [drawFrame]);

  const restartGame = () => {
    worldRef.current = buildWorld(0, 0, 3);
    setUiScore(0); setUiLives(3); setUiLevel(1); setUiStealth(true);
    canShootRef.current = true;
    setPhase("playing");
  };

  const enemiesLeft = worldRef.current.enemies.filter((e) => e.alive).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Stealth Shooter</h1>
            <p className="text-slate-400 text-sm">Eliminate enemies or reach the goal</p>
          </div>
          <div className="bg-slate-700 rounded-xl px-5 py-2 text-center">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Level</div>
            <div className="text-2xl font-bold text-yellow-400">{uiLevel} / {LEVEL_ENEMIES.length}</div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800 rounded-lg px-4 py-2 mb-4 text-sm text-slate-300 flex flex-wrap gap-4">
          <span>Arrows to move</span>
          <span>•</span>
          <span>Move mouse to aim · Space to shoot</span>
          <span>•</span>
          <span>Stand still → invisible (enemies can&apos;t see you)</span>
          <span>•</span>
          <span>Reach the green GOAL or kill all enemies</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Game */}
          <div className="flex-1">
            {/* Stats */}
            <div className="flex gap-3 mb-3">
              <div className="bg-slate-800 rounded-lg px-3 py-2 text-center flex-1">
                <div className="text-xs text-slate-400 uppercase tracking-widest">Score</div>
                <div className="text-xl font-bold text-yellow-400">{uiScore}</div>
              </div>
              <div className="bg-slate-800 rounded-lg px-3 py-2 text-center flex-1">
                <div className="text-xs text-slate-400 uppercase tracking-widest">Lives</div>
                <div className="text-xl font-bold text-red-400">{"♥".repeat(uiLives)}{"♡".repeat(Math.max(0, 3 - uiLives))}</div>
              </div>
              <div className="bg-slate-800 rounded-lg px-3 py-2 text-center flex-1">
                <div className="text-xs text-slate-400 uppercase tracking-widest">Enemies</div>
                <div className="text-xl font-bold text-orange-400">{enemiesLeft}</div>
              </div>
              <div className={`rounded-lg px-3 py-2 text-center flex-1 ${uiStealth ? "bg-blue-900" : "bg-red-900"}`}>
                <div className="text-xs uppercase tracking-widest opacity-70">Status</div>
                <div className={`text-sm font-bold ${uiStealth ? "text-blue-300" : "text-red-300"}`}>
                  {uiStealth ? "STEALTH" : "VISIBLE"}
                </div>
              </div>
            </div>

            <div className="relative">
              <canvas
                ref={canvasRef}
                width={VIEW_W}
                height={VIEW_H}
                className="block rounded-lg border-2 border-slate-600 cursor-crosshair"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                }}
              />

              {phase === "levelComplete" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 rounded-lg">
                  <div className="text-3xl font-black text-yellow-400 mb-2">{levelMsg}</div>
                  <div className="text-slate-300">Loading next level…</div>
                </div>
              )}
              {phase === "gameOver" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 rounded-lg">
                  <div className="text-4xl font-black text-red-400 mb-2">GAME OVER</div>
                  <div className="text-slate-300 mb-6">Score: {uiScore}</div>
                  <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-lg" onClick={restartGame}>Play Again</button>
                </div>
              )}
              {phase === "win" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 rounded-lg">
                  <div className="text-4xl font-black text-green-400 mb-2">Mission Complete! You Win!</div>
                  <div className="text-slate-300 mb-6">Final Score: {uiScore}</div>
                  <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-lg" onClick={restartGame}>Play Again</button>
                </div>
              )}
            </div>

            {/* Ad below viewport */}
            <div className="mt-4">
              <AdPlaceholder />
            </div>
          </div>

          {/* Right sidebar */}
          <div className="flex-shrink-0 w-52 flex flex-col gap-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wide">Levels</h3>
              {LEVEL_ENEMIES.map((lv, i) => (
                <div key={i} className={`flex items-center justify-between py-1 text-sm border-b border-slate-700 last:border-0 ${i + 1 === uiLevel ? "text-yellow-400 font-bold" : "text-slate-500"}`}>
                  <span>Level {i + 1}</span>
                  <span className="text-xs">{lv.length} enemies</span>
                  {i + 1 < uiLevel && <span className="text-green-400">✓</span>}
                </div>
              ))}
            </div>
            <div className="bg-slate-800 rounded-lg p-4 text-xs text-slate-400 space-y-2">
              <div className="font-bold text-slate-300 text-sm mb-1">Legend</div>
              <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-blue-400"></span> You (player)</div>
              <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-yellow-400"></span> Enemy (patrolling)</div>
              <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-red-500"></span> Enemy (alerted)</div>
              <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 bg-green-500"></span> Goal zone</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}