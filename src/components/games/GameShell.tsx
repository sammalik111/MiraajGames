"use client";

import { ReactNode, useCallback, useState } from "react";
import GameOverPanel from "./GameOverPanel";

interface Props {
  gameId: number;
  // Render-prop: receives onGameEnd to wire into the game, and runKey to
  // remount the game on retry (just put it on the wrapping element's `key`).
  children: (api: {
    onGameEnd: (score: number, metadata?: Record<string, unknown>) => void;
    runKey: number;
  }) => ReactNode;
}

// Wraps any leaderboard-aware game. Catches the onGameEnd callback, fires the
// score submission, and overlays the leaderboard panel. "Play again" bumps
// runKey, which the game uses as its React key — clean remount, no per-game
// reset code needed.
export default function GameShell({ gameId, children }: Props) {
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [finalMeta, setFinalMeta] = useState<Record<string, unknown> | undefined>();
  const [runKey, setRunKey] = useState(0);

  const handleEnd = useCallback(
    (score: number, metadata?: Record<string, unknown>) => {
      setFinalScore(score);
      setFinalMeta(metadata);
      // Fire-and-forget. Network failure shouldn't block the UI — the user
      // still sees their score and the existing leaderboard.
      fetch(`/api/games/${gameId}/submitScore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, metadata }),
      }).catch(() => {});
    },
    [gameId],
  );

  const restart = useCallback(() => {
    setFinalScore(null);
    setFinalMeta(undefined);
    setRunKey((k) => k + 1);
  }, []);

  return (
    <div className="relative">
      {children({ onGameEnd: handleEnd, runKey })}
      {finalScore !== null && (
        <GameOverPanel
          gameId={gameId}
          score={finalScore}
          metadata={finalMeta}
          onRetry={restart}
        />
      )}
    </div>
  );
}
