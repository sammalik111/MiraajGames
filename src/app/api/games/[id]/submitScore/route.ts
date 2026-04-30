import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireUser } from "@/lib/requireUser";
import { db, gameScores, bestScoresForGame } from "@/db";
import { games } from "@/data/gameData";
import { makeId } from "@/lib/ids";

// POST /api/games/[id]/submitScore
// Body: { score: number, metadata?: object, runId?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser();
    if (typeof userId !== "string") return userId;

    const { id } = await params;
    const gameId = parseInt(id, 10);
    if (Number.isNaN(gameId)) {
      return NextResponse.json({ error: "invalid game id" }, { status: 400 });
    }

    // Look up the game's config (version + sort direction). Bail if unknown.
    const game = games.find((g) => g.id === gameId);
    if (!game) {
      return NextResponse.json({ error: "game not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { score, metadata, runId } = body as {
      score?: unknown;
      metadata?: Record<string, unknown>;
      runId?: string;
    };

    if (typeof score !== "number" || !Number.isFinite(score)) {
      return NextResponse.json({ error: "score must be a number" }, { status: 400 });
    }

    const gameVersion = game.version ?? 1;
    // DESC = higher is better (Tetris). ASC = lower is better (Sudoku time).
    const isDesc = game.sortedOrder === "DESC";

    // 1. Audit log — always write.
    await db.insert(gameScores).values({
      id: makeId(),
      userId,
      gameId,
      score,
      metadata: metadata ?? null,
      gameVersion,
      runId: runId ?? null,
    });

    // 2. Materialized leaderboard — upsert, only overwrite if new score is better.
    // EXCLUDED.score is Postgres-speak for "the score we just tried to insert".
    await db
      .insert(bestScoresForGame)
      .values({
        gameId,
        userId,
        score,
        metadata: metadata ?? null,
        gameVersion,
      })
      .onConflictDoUpdate({
        target: [bestScoresForGame.gameId, bestScoresForGame.userId],
        set: {
          score: sql`EXCLUDED.score`,
          metadata: sql`EXCLUDED.metadata`,
          achievedAt: sql`now()`,
        },
        // Only update when the new score actually beats the stored one.
        where: isDesc
          ? sql`${bestScoresForGame.score} < EXCLUDED.score`
          : sql`${bestScoresForGame.score} > EXCLUDED.score`,
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error submitting score:", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
