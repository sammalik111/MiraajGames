"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Canvas dimensions — fixed so physics constants stay consistent across screens.
const W = 480;
const H = 640;

// Tuning constants. Tweak these to change feel.
const GRAVITY = 0.45;
const JUMP_V = -7.6;
const PIPE_SPEED = 2.4;
const PIPE_GAP = 160;
const PIPE_INTERVAL = 1500;
const PIPE_W = 64;
const BIRD_R = 14;
const GROUND_H = 70;

type Pipe = { x: number; gapY: number; passed: boolean };
type Cloud = { x: number; y: number; scale: number; speed: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export default function FlappyBirdGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [running, setRunning] = useState(false);
  const [dead, setDead] = useState(false);

  const birdY = useRef(H / 2);
  const birdV = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const clouds = useRef<Cloud[]>([]);
  const particles = useRef<Particle[]>([]);
  const lastPipeAt = useRef(0);
  const groundOffset = useRef(0);
  const wingPhase = useRef(0);
  const flashAlpha = useRef(0);
  const rafId = useRef<number | null>(null);

  const seedClouds = useCallback(() => {
    clouds.current = Array.from({ length: 6 }, () => ({
      x: Math.random() * W,
      y: 40 + Math.random() * 220,
      scale: 0.6 + Math.random() * 0.9,
      speed: 0.15 + Math.random() * 0.25,
    }));
  }, []);

  const reset = useCallback(() => {
    birdY.current = H / 2;
    birdV.current = 0;
    pipes.current = [];
    particles.current = [];
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
    // Tiny puff trail on flap
    for (let i = 0; i < 4; i++) {
      particles.current.push({
        x: W / 4 - BIRD_R,
        y: birdY.current + (Math.random() - 0.5) * 8,
        vx: -1 - Math.random() * 1.2,
        vy: (Math.random() - 0.5) * 0.6,
        life: 30,
        color: "rgba(255,255,255,0.6)",
      });
    }
  }, [dead, running, reset]);

  useEffect(() => {
    seedClouds();
  }, [seedClouds]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let prev = performance.now();

    const drawCloud = (cx: number, cy: number, s: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(cx, cy, 18 * s, 0, Math.PI * 2);
      ctx.arc(cx + 16 * s, cy + 4 * s, 14 * s, 0, Math.PI * 2);
      ctx.arc(cx - 14 * s, cy + 6 * s, 13 * s, 0, Math.PI * 2);
      ctx.arc(cx + 4 * s, cy - 8 * s, 12 * s, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawBird = (bx: number, by: number, rot: number, wing: number) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rot);

      // Shadow under bird
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(0, BIRD_R + 3, BIRD_R * 0.9, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body (radial gradient = subtle 3D)
      const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, BIRD_R);
      grad.addColorStop(0, "#fff09a");
      grad.addColorStop(0.6, "#ffd400");
      grad.addColorStop(1, "#e09a00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
      ctx.fill();

      // Belly highlight
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(2, 5, BIRD_R * 0.55, BIRD_R * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing — animated by wingPhase
      ctx.fillStyle = "#d18b00";
      ctx.beginPath();
      const wingY = Math.sin(wing) * 4;
      ctx.ellipse(-3, 2 + wingY, 8, 5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a96a00";
      ctx.beginPath();
      ctx.ellipse(-3, 2 + wingY, 5, 3, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(5, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(6, -4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(6.5, -4.5, 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = "#ff8800";
      ctx.beginPath();
      ctx.moveTo(BIRD_R - 2, -2);
      ctx.lineTo(BIRD_R + 8, 0);
      ctx.lineTo(BIRD_R - 2, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#cc5e00";
      ctx.beginPath();
      ctx.moveTo(BIRD_R - 2, 1);
      ctx.lineTo(BIRD_R + 8, 0);
      ctx.lineTo(BIRD_R - 2, 3);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    const drawPipe = (x: number, gapY: number) => {
      const pipeBodyGrad = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
      pipeBodyGrad.addColorStop(0, "#1f6b1f");
      pipeBodyGrad.addColorStop(0.3, "#4ec24e");
      pipeBodyGrad.addColorStop(0.5, "#7be07b");
      pipeBodyGrad.addColorStop(0.7, "#4ec24e");
      pipeBodyGrad.addColorStop(1, "#1f6b1f");

      // Top pipe body
      ctx.fillStyle = pipeBodyGrad;
      ctx.fillRect(x, 0, PIPE_W, gapY - 18);
      // Top pipe cap
      ctx.fillStyle = pipeBodyGrad;
      ctx.fillRect(x - 4, gapY - 18, PIPE_W + 8, 18);
      // Cap shine
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x - 2, gapY - 16, 6, 14);
      // Cap edge shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x + PIPE_W - 4, gapY - 18, 4, 18);

      // Bottom pipe
      const bottomY = gapY + PIPE_GAP;
      ctx.fillStyle = pipeBodyGrad;
      ctx.fillRect(x, bottomY + 18, PIPE_W, H - GROUND_H - bottomY - 18);
      ctx.fillRect(x - 4, bottomY, PIPE_W + 8, 18);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x - 2, bottomY + 2, 6, 14);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x + PIPE_W - 4, bottomY, 4, 18);
    };

    const draw = (now: number) => {
      const dt = (now - prev) / 16.67; // normalize to 60fps frames
      prev = now;

      // --- Sky gradient ---
      const sky = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
      sky.addColorStop(0, "#5fb6ec");
      sky.addColorStop(0.5, "#8fd1f0");
      sky.addColorStop(1, "#cdebf7");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H - GROUND_H);

      // Sun
      const sunGrad = ctx.createRadialGradient(W - 80, 90, 8, W - 80, 90, 60);
      sunGrad.addColorStop(0, "rgba(255, 245, 180, 1)");
      sunGrad.addColorStop(0.4, "rgba(255, 220, 120, 0.6)");
      sunGrad.addColorStop(1, "rgba(255, 220, 120, 0)");
      ctx.fillStyle = sunGrad;
      ctx.fillRect(W - 160, 20, 160, 140);
      ctx.fillStyle = "#fff5b4";
      ctx.beginPath();
      ctx.arc(W - 80, 90, 26, 0, Math.PI * 2);
      ctx.fill();

      // Distant hills (parallax)
      ctx.fillStyle = "#7bb87b";
      const hillOff = (groundOffset.current * 0.2) % 200;
      ctx.beginPath();
      ctx.moveTo(0, H - GROUND_H);
      for (let i = -1; i < 4; i++) {
        const cx = i * 200 - hillOff;
        ctx.quadraticCurveTo(cx + 50, H - GROUND_H - 80, cx + 100, H - GROUND_H);
        ctx.quadraticCurveTo(cx + 150, H - GROUND_H - 50, cx + 200, H - GROUND_H);
      }
      ctx.lineTo(W, H - GROUND_H);
      ctx.closePath();
      ctx.fill();

      // Clouds
      for (const c of clouds.current) {
        c.x -= c.speed * dt;
        if (c.x < -60) c.x = W + 40;
        drawCloud(c.x, c.y, c.scale);
      }

      if (running && !dead) {
        birdV.current += GRAVITY;
        birdY.current += birdV.current;

        if (now - lastPipeAt.current > PIPE_INTERVAL) {
          const gapY = 80 + Math.random() * (H - GROUND_H - 160 - PIPE_GAP);
          pipes.current.push({ x: W, gapY, passed: false });
          lastPipeAt.current = now;
        }

        for (const p of pipes.current) p.x -= PIPE_SPEED;
        pipes.current = pipes.current.filter((p) => p.x + PIPE_W > 0);

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

        const bx = W / 4;
        const by = birdY.current;
        if (by + BIRD_R >= H - GROUND_H || by - BIRD_R <= 0) {
          setDead(true);
          flashAlpha.current = 1;
          // Death feathers
          for (let i = 0; i < 14; i++) {
            particles.current.push({
              x: bx,
              y: by,
              vx: (Math.random() - 0.5) * 6,
              vy: -2 - Math.random() * 4,
              life: 60,
              color: "#ffd400",
            });
          }
        } else {
          for (const p of pipes.current) {
            const inX = bx + BIRD_R > p.x && bx - BIRD_R < p.x + PIPE_W;
            const outOfGap = by - BIRD_R < p.gapY || by + BIRD_R > p.gapY + PIPE_GAP;
            if (inX && outOfGap) {
              setDead(true);
              flashAlpha.current = 1;
              for (let i = 0; i < 14; i++) {
                particles.current.push({
                  x: bx,
                  y: by,
                  vx: (Math.random() - 0.5) * 6,
                  vy: -2 - Math.random() * 4,
                  life: 60,
                  color: "#ffd400",
                });
              }
              break;
            }
          }
        }

        groundOffset.current += PIPE_SPEED * dt;
        wingPhase.current += 0.4 * dt;
      } else if (!dead) {
        // Idle wing flap on title screen
        wingPhase.current += 0.2 * dt;
      }

      // Pipes
      for (const p of pipes.current) drawPipe(p.x, p.gapY);

      // Particles
      particles.current = particles.current.filter((p) => p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 1;
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      // Ground (textured)
      const groundGrad = ctx.createLinearGradient(0, H - GROUND_H, 0, H);
      groundGrad.addColorStop(0, "#e8d472");
      groundGrad.addColorStop(1, "#b89a3a");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, H - GROUND_H, W, GROUND_H);

      // Grass strip
      ctx.fillStyle = "#7ec850";
      ctx.fillRect(0, H - GROUND_H, W, 8);
      ctx.fillStyle = "#4f9a2c";
      const goff = groundOffset.current % 16;
      for (let x = -goff; x < W; x += 16) {
        ctx.fillRect(x, H - GROUND_H + 6, 8, 3);
      }
      // Ground stripes for motion
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      for (let x = -goff * 2; x < W; x += 32) {
        ctx.fillRect(x, H - GROUND_H + 20, 16, 4);
      }

      // Bird
      const tilt = Math.max(-0.5, Math.min(1.2, birdV.current * 0.08));
      drawBird(W / 4, birdY.current, tilt, wingPhase.current);

      // Death flash
      if (flashAlpha.current > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha.current})`;
        ctx.fillRect(0, 0, W, H);
        flashAlpha.current = Math.max(0, flashAlpha.current - 0.06);
      }

      // Score (big, drop-shadowed)
      ctx.font = "bold 44px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillText(String(score), W / 2 + 3, 73);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 4;
      ctx.strokeText(String(score), W / 2, 70);
      ctx.fillText(String(score), W / 2, 70);

      if (!running) {
        // Title plate
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(40, H / 2 - 90, W - 80, 180);
        ctx.strokeStyle = "#ffd400";
        ctx.lineWidth = 3;
        ctx.strokeRect(40, H / 2 - 90, W - 80, 180);
        ctx.fillStyle = "#ffd400";
        ctx.font = "bold 32px monospace";
        ctx.fillText("FLAPPY BIRD", W / 2, H / 2 - 40);
        ctx.fillStyle = "#fff";
        ctx.font = "16px monospace";
        ctx.fillText("Click / Space to flap", W / 2, H / 2 - 5);
        ctx.fillText("Survive as long as you can", W / 2, H / 2 + 22);
        ctx.fillStyle = "#5fb6ec";
        ctx.font = "12px monospace";
        ctx.fillText("▸ tap to start", W / 2, H / 2 + 55);
      } else if (dead) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(40, H / 2 - 100, W - 80, 200);
        ctx.strokeStyle = "#ff5555";
        ctx.lineWidth = 3;
        ctx.strokeRect(40, H / 2 - 100, W - 80, 200);
        ctx.fillStyle = "#ff5555";
        ctx.font = "bold 36px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", W / 2, H / 2 - 50);
        ctx.fillStyle = "#fff";
        ctx.font = "20px monospace";
        ctx.fillText(`Score: ${score}`, W / 2, H / 2 - 10);
        ctx.fillStyle = "#ffd400";
        ctx.fillText(`Best:  ${best}`, W / 2, H / 2 + 18);
        ctx.fillStyle = "#fff";
        ctx.font = "14px monospace";
        ctx.fillText("Click / Space to retry", W / 2, H / 2 + 60);
      }

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
        className="border border-[color:var(--border-strong)] cursor-pointer max-w-full h-auto rounded-sm shadow-[0_0_24px_rgba(0,0,0,0.4)]"
        style={{ touchAction: "none", imageRendering: "auto" }}
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
