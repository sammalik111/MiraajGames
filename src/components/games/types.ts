// The contract every leaderboard-aware game implements.
//
// Games stay dumb about your backend. They just call onGameEnd(score) once
// when their internal "run is over" condition fires (death / time up / win /
// loss / level complete). The wrapping GameShell handles submit + leaderboard.
//
// metadata is optional per-game extras (e.g. { lines: 12, level: 4 } for
// Tetris) — stored as jsonb on the audit row, useful later for analytics
// and anti-cheat plausibility checks.
export interface GameProps {
  onGameEnd: (score: number, metadata?: Record<string, unknown>) => void;
}
