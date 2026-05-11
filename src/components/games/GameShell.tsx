"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
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

// Delay between onGameEnd firing and the leaderboard overlay appearing. Lets
// the game's death animation (flash, particles, final settle) play out so the
// transition doesn't feel abrupt. The score POST fires immediately — by the
// time the panel mounts and fetches the board, the new score is already in.
const PANEL_REVEAL_DELAY_MS = 700;

export default function GameShell({ gameId, children }: Props) {
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [finalMeta, setFinalMeta] = useState<Record<string, unknown> | undefined>();
  const [showPanel, setShowPanel] = useState(false);
  const [runKey, setRunKey] = useState(0);

  const handleEnd = useCallback(
    (score: number, metadata?: Record<string, unknown>) => {
      setFinalScore(score);
      setFinalMeta(metadata);
      // Submit the score first so the best-score upsert lands before
      // the stats update recomputes the high-score count. Both are
      // fire-and-forget — the panel can read the leaderboard while
      // they're still in flight.
      (async () => {
        try {
          await fetch(`/api/games/${gameId}/submitScore`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score, metadata }),
          });
          fetch(`/api/stats/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gameId, score }),
          }).catch(() => {});
        } catch {}
      })();
    },
    [gameId],
  );

  // Stage the panel reveal so the death animation plays first.
  useEffect(() => {
    if (finalScore === null) {
      setShowPanel(false);
      return;
    }
    const t = setTimeout(() => setShowPanel(true), PANEL_REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, [finalScore]);

  const restart = useCallback(() => {
    setFinalScore(null);
    setFinalMeta(undefined);
    setShowPanel(false);
    setRunKey((k) => k + 1);
  }, []);

  return (
    <div className="relative">
      {children({ onGameEnd: handleEnd, runKey })}
      {showPanel && finalScore !== null && (
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
