import { and, asc, desc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, bestScoresForGame, gameScores, users } from "@/db";
import { displayName } from "@/db/displayName";
import { games } from "@/data/gameData";

// GET /api/games/[id]/leaderboard?limit=10
// Returns the top N scores for this game, joined with user display info.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const gameId = parseInt(id, 10);
    if (Number.isNaN(gameId)) {
      return NextResponse.json({ error: "invalid game id" }, { status: 400 });
    }

    const game = games.find((g) => g.id === gameId);
    if (!game) {
      return NextResponse.json({ error: "game not found" }, { status: 404 });
    }

    // Clamp limit to [1, 100] so the client can't ask for the whole table.
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
    );

    const gameVersion = game.version ?? 1;
    const isDesc = game.sortedOrder === "DESC";

    // Daily-reset games (e.g. Wordle) pull from the audit log filtered to
    // today's UTC day rather than the all-time best-score table. Each
    // user already plays at most once per day, so no per-user dedupe needed.
    let rows;
    if (game.dailyReset) {
      const now = new Date();
      const dayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const scoreOrder = isDesc ? desc(gameScores.score) : asc(gameScores.score);
      rows = await db
        .select({
          userId: gameScores.userId,
          score: gameScores.score,
          achievedAt: gameScores.achievedAt,
          name: displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(gameScores)
        .leftJoin(users, eq(users.id, gameScores.userId))
        .where(
          and(
            eq(gameScores.gameId, gameId),
            eq(gameScores.gameVersion, gameVersion),
            gte(gameScores.achievedAt, dayStart),
          ),
        )
        .orderBy(scoreOrder, asc(gameScores.achievedAt))
        .limit(limit);
    } else {
      const scoreOrder = isDesc
        ? desc(bestScoresForGame.score)
        : asc(bestScoresForGame.score);
      rows = await db
        .select({
          userId: bestScoresForGame.userId,
          score: bestScoresForGame.score,
          achievedAt: bestScoresForGame.achievedAt,
          name: displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(bestScoresForGame)
        .leftJoin(users, eq(users.id, bestScoresForGame.userId))
        .where(
          and(
            eq(bestScoresForGame.gameId, gameId),
            eq(bestScoresForGame.gameVersion, gameVersion),
          ),
        )
        .orderBy(scoreOrder, asc(bestScoresForGame.achievedAt))
        .limit(limit);
    }

    const entries = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      name: r.name ?? "Unknown",
      avatarUrl: r.avatarUrl ?? null,
      score: r.score,
      achievedAt: r.achievedAt,
    }));

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error retrieving leaderboard:", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
