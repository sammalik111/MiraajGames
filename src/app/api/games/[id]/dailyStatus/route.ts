import { NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { requireUser } from "@/lib/requireUser";
import { db, gameScores } from "@/db";

// GET /api/games/[id]/dailyStatus
// Returns whether the user already submitted a score for this game on the
// current UTC day. Used to gate daily-once games like Wordle so a user can't
// retry to get a better score.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const { id } = await params;
  const gameId = parseInt(id, 10);
  if (Number.isNaN(gameId)) {
    return NextResponse.json({ error: "invalid game id" }, { status: 400 });
  }

  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const [row] = await db
    .select({
      score: gameScores.score,
      metadata: gameScores.metadata,
      achievedAt: gameScores.achievedAt,
    })
    .from(gameScores)
    .where(
      and(
        eq(gameScores.userId, userId),
        eq(gameScores.gameId, gameId),
        gte(gameScores.achievedAt, dayStart),
      ),
    )
    .limit(1);

  return NextResponse.json({
    playedToday: !!row,
    score: row?.score ?? null,
    metadata: row?.metadata ?? null,
    achievedAt: row?.achievedAt ?? null,
  });
}
