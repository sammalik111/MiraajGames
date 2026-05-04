"use client";

// Generic end-of-game overlay for any multiplayer game. The owning
// component decides the outcome (win/loss/draw) and wires up the rematch
// state machine via useRematchVote — this component is purely visual.
//
// Each MP game can override the headline / subtitle / accent if it wants
// to flavor the messaging (e.g. Battleship's "FLEET SUNK"). Defaults
// produce a generic "YOU WIN / YOU LOSE / DRAW".

import type { ReactNode } from "react";

export type Outcome = "win" | "loss" | "draw";

interface Props {
  outcome: Outcome;
  opponentName: string;
  // Customization (optional)
  headline?: string;
  subtitle?: ReactNode;
  // Rematch state machine — pass straight from useRematchVote
  iVoted: boolean;
  opponentVoted: boolean;
  opponentPresent: boolean;
  voting: boolean;
  // Action callbacks
  onRematch: () => void;
  onCancelVote: () => void;
  onLeave: () => void;
  // Optional inline error banner (e.g. from useRematchVote.voteError)
  errorMessage?: string | null;
}

const OUTCOME_DEFAULTS: Record<
  Outcome,
  { headline: string; accent: string; subtitle: (op: string) => string }
> = {
  win: {
    headline: "YOU WIN",
    accent: "var(--neon-lime)",
    subtitle: (op) => `Nice. ${op} didn't see it coming.`,
  },
  loss: {
    headline: "YOU LOSE",
    accent: "var(--neon-magenta)",
    subtitle: (op) => `${op} took it. Get them next round.`,
  },
  draw: {
    headline: "DRAW",
    accent: "var(--neon-yellow)",
    subtitle: () => "Even match. Run it back?",
  },
};

export default function MultiplayerEndOverlay({
  outcome,
  opponentName,
  headline,
  subtitle,
  iVoted,
  opponentVoted,
  opponentPresent,
  voting,
  onRematch,
  onCancelVote,
  onLeave,
  errorMessage,
}: Props) {
  const defaults = OUTCOME_DEFAULTS[outcome];
  const accent = defaults.accent;
  const finalHeadline = headline ?? defaults.headline;
  const finalSubtitle = subtitle ?? defaults.subtitle(opponentName);

  // Rematch button state machine. Same four states across every MP game:
  //   idle    — neither voted yet → "↻ Rematch"
  //   waiting — I voted, opponent hasn't → "Waiting for opponent..."
  //   accept  — opponent voted, I haven't → "✓ Accept Rematch"
  //   blocked — opponent left → "Rematch unavailable"
  const rematchState: "idle" | "waiting" | "accept" | "blocked" = !opponentPresent
    ? "blocked"
    : iVoted && !opponentVoted
      ? "waiting"
      : !iVoted && opponentVoted
        ? "accept"
        : "idle";

  const rematchLabel = {
    idle: "↻ Rematch",
    waiting: "Waiting for opponent...",
    accept: "✓ Accept Rematch",
    blocked: "Rematch unavailable",
  }[rematchState];

  const rematchHint =
    rematchState === "blocked"
      ? `${opponentName} left the room.`
      : rematchState === "waiting"
        ? `Sent. ${opponentName} has to accept.`
        : rematchState === "accept"
          ? `${opponentName} wants a rematch.`
          : null;

  const rematchDisabled =
    voting || rematchState === "waiting" || rematchState === "blocked";

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4"
      style={{ animation: "panelFade 220ms ease-out" }}
    >
      <style jsx>{`
        @keyframes panelFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <div
        className="w-full max-w-sm border bg-[color:var(--surface-1)]"
        style={{ borderColor: accent }}
      >
        {/* Header strip */}
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{
            background: `linear-gradient(90deg, ${accent}22, transparent)`,
            borderBottom: `1px solid ${accent}44`,
          }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.3em]"
            style={{ color: accent }}
          >
            ▸ Match over
          </span>
        </div>

        {/* Result */}
        <div className="px-5 pt-6 pb-5 text-center border-b border-[color:var(--border)]">
          <p
            className="font-display font-black text-4xl leading-none"
            style={{ color: accent, textShadow: `0 0 24px ${accent}88` }}
          >
            {finalHeadline}
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] leading-relaxed">
            {finalSubtitle}
          </p>
        </div>

        {/* Rematch progress hint */}
        {rematchHint && (
          <p
            className="px-5 pt-3 text-center font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{
              color:
                rematchState === "blocked"
                  ? "var(--neon-magenta)"
                  : rematchState === "accept"
                    ? "var(--neon-lime)"
                    : "var(--fg-muted)",
            }}
          >
            {rematchHint}
          </p>
        )}

        {/* Action error (from rematch hook) */}
        {errorMessage && (
          <p className="px-5 pt-2 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
            ✕ {errorMessage}
          </p>
        )}

        {/* Action buttons */}
        <div className="p-4 grid grid-cols-2 gap-2">
          <button
            onClick={onLeave}
            disabled={voting}
            className="font-mono text-xs uppercase tracking-[0.25em] py-3 border border-[color:var(--neon-magenta)] text-[color:var(--neon-magenta)] hover:bg-[color:var(--neon-magenta)]/10 transition disabled:opacity-40"
          >
            ← Leave
          </button>
          <button
            onClick={onRematch}
            disabled={rematchDisabled}
            className="font-mono text-xs uppercase tracking-[0.25em] py-3 text-black transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                rematchState === "blocked"
                  ? "var(--surface-3, #444)"
                  : "var(--neon-cyan)",
              boxShadow:
                rematchState === "blocked"
                  ? "none"
                  : "0 0 20px -4px var(--neon-cyan)",
            }}
          >
            {rematchLabel}
          </button>
        </div>

        {/* Cancel-vote link, only relevant in the waiting state */}
        {rematchState === "waiting" && (
          <div className="px-4 pb-4 -mt-2">
            <button
              onClick={onCancelVote}
              disabled={voting}
              className="w-full font-mono text-[10px] uppercase tracking-[0.22em] py-1 text-[color:var(--fg-muted)] hover:text-[color:var(--neon-magenta)] transition disabled:opacity-40"
            >
              ⨯ Cancel rematch request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
