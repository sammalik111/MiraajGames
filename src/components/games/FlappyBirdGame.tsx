"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Canvas dimensions — fixed so physics constants stay consistent across screens.
const W = 480;
const H = 640;

// Tuning constants. Tweak these to change feel.
const GRAVITY = 0.45;
const JUMP_V = -7.6;
const PIPE_SPEED = 2.4;
const PIPE_GAP = 160;          // vertical gap between top/bottom pipe
const PIPE_INTERVAL = 1500;    // ms between new pipes
const PIPE_W = 60;
const BIRD_R = 14;             // bird radius (it's a circle — pure geometry, no sprites)
const GROUND_H = 60;

type Pipe = { x: number; gapY: number; passed: boolean };

export default function FlappyBirdGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [running, setRunning] = useState(false);
  const [dead, setDead] = useState(false);

  // Mutable game state lives in refs so the rAF loop doesn't re-bind every frame.
  const birdY = useRef(H / 2);
  const birdV = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const lastPipeAt = useRef(0);
  const rafId = useRef<number | null>(null);

  const reset = useCallback(() => {
    birdY.current = H / 2;
    birdV.current = 0;
    pipes.current = [];
    lastPipeAt.current = 0;
    setScore(0);
    setDead(false);
  }, []);

  const flap = useCallback(() => {
    if (dead) {
      reset();
      setRunning(true);
      return;
    }
    if (!running) setRunning(true);
    birdV.current = JUMP_V;
  }, [dead, running, reset]);

  // Single key/click handler — space, up arrow, click, tap all flap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  // Main loop — pure rAF, time-based pipe spawning so cadence matches wall-clock.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let prev = performance.now();

    const draw = (now: number) => {
      const dt = now - prev;
      prev = now;

      // Sky
      ctx.fillStyle = "#87ceeb";
      ctx.fillRect(0, 0, W, H);

      if (running && !dead) {
        // Physics
        birdV.current += GRAVITY;
        birdY.current += birdV.current;

        // Spawn pipes on a timer rather than per-frame distance so it's framerate-stable.
        if (now - lastPipeAt.current > PIPE_INTERVAL) {
          const gapY = 80 + Math.random() * (H - GROUND_H - 160 - PIPE_GAP);
          pipes.current.push({ x: W, gapY, passed: false });
          lastPipeAt.current = now;
        }

        // Move pipes, drop the ones that fully scrolled off.
        for (const p of pipes.current) p.x -= PIPE_SPEED;
        pipes.current = pipes.current.filter((p) => p.x + PIPE_W > 0);

        // Score: bird's leading edge cleared the pipe's trailing edge.
        for (const p of pipes.current) {
          if (!p.passed && p.x + PIPE_W < W / 4 - BIRD_R) {
            p.passed = true;
            setScore((s) => {
              const ns = s + 1;
              setBest((b) => Math.max(b, ns));
              return ns;
            });
          }
        }

        // Collisions — circle vs rect AABB on each pipe, plus ground/ceiling.
        const bx = W / 4;
        const by = birdY.current;
        if (by + BIRD_R >= H - GROUND_H || by - BIRD_R <= 0) {
          setDead(true);
        } else {
          for (const p of pipes.current) {
            const inX = bx + BIRD_R > p.x && bx - BIRD_R < p.x + PIPE_W;
            const outOfGap = by - BIRD_R < p.gapY || by + BIRD_R > p.gapY + PIPE_GAP;
            if (inX && outOfGap) {
              setDead(true);
              break;
            }
          }
        }
      }

      // --- Render ---
      // Pipes
      ctx.fillStyle = "#2e8b2e";
      for (const p of pipes.current) {
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        ctx.fillRect(p.x, p.gapY + PIPE_GAP, PIPE_W, H - GROUND_H - (p.gapY + PIPE_GAP));
      }

      // Ground
      ctx.fillStyle = "#ded895";
      ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
      ctx.fillStyle = "#7ec850";
      ctx.fillRect(0, H - GROUND_H, W, 6);

      // Bird
      ctx.fillStyle = "#ffd400";
      ctx.beginPath();
      ctx.arc(W / 4, birdY.current, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(W / 4 + 4, birdY.current - 3, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff7a00";
      ctx.fillRect(W / 4 + BIRD_R - 2, birdY.current - 1, 6, 3);

      // Score
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.font = "bold 36px monospace";
      ctx.textAlign = "center";
      ctx.strokeText(String(score), W / 2, 60);
      ctx.fillText(String(score), W / 2, 60);

      if (!running) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, H / 2 - 80, W, 160);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 28px monospace";
        ctx.fillText("FLAPPY BIRD", W / 2, H / 2 - 30);
        ctx.font = "16px monospace";
        ctx.fillText("Click / Space to flap", W / 2, H / 2 + 4);
        ctx.fillText("Survive as long as you can", W / 2, H / 2 + 30);
      } else if (dead) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, H / 2 - 90, W, 180);
        ctx.fillStyle = "#ff5555";
        ctx.font = "bold 32px monospace";
        ctx.fillText("GAME OVER", W / 2, H / 2 - 40);
        ctx.fillStyle = "#fff";
        ctx.font = "18px monospace";
        ctx.fillText(`Score: ${score}`, W / 2, H / 2);
        ctx.fillText(`Best:  ${best}`, W / 2, H / 2 + 24);
        ctx.font = "14px monospace";
        ctx.fillText("Click / Space to retry", W / 2, H / 2 + 60);
      }

      // Suppress unused dt warning — kept for future framerate-independent physics.
      void dt;

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [running, dead, score, best]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
        <span>Score: <span className="text-[color:var(--neon-cyan)]">{score}</span></span>
        <span>Best: <span className="text-[color:var(--neon-magenta)]">{best}</span></span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={flap}
        onTouchStart={(e) => { e.preventDefault(); flap(); }}
        className="border border-[color:var(--border-strong)] cursor-pointer max-w-full h-auto"
        style={{ touchAction: "none" }}
      />
      <button
        onClick={() => { reset(); setRunning(false); }}
        className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-2 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:ring-cyan transition"
      >
        Reset
      </button>
    </div>
  );
}
