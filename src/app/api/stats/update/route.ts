import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireUser } from "@/lib/requireUser";
import { db, bestScoresForGame, userStatsTable } from "@/db";
import { games } from "@/data/gameData";

// POST /api/stats/update
// Body: { gameId: number, score?: number, outcome?: "win"|"loss"|"draw"|"forfeit" }
//
// Central stats updater. Looks up the game's grouping from gameData and
// routes accordingly:
//
//   Singleplayer  ─→ increments gamesPlayed
//   Multiplayer   ─→ increments gamesWon / gamesLost / gamesDrawn /
//                    forfeits based on outcome, updates streaks
//
// Both types also update: pointsWon (+= score), highScore (recomputed
// fresh — count of games where this user holds the top score), and
// the lastPlayedAt + updatedAt timestamps. firstPlayedAt is set on
// insert only.

type Outcome = "win" | "loss" | "draw" | "forfeit";
const VALID_OUTCOMES: Outcome[] = ["win", "loss", "draw", "forfeit"];

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const body = await req.json().catch(() => ({}));
  const { gameId, score, outcome } = body as {
    gameId?: number;
    score?: number;
    outcome?: Outcome;
  };

  if (typeof gameId !== "number") {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }
  const game = games.find((g) => g.id === gameId);
  if (!game) {
    return NextResponse.json({ error: "game not found" }, { status: 404 });
  }

  const isMultiplayer = game.grouping === "multiplayer";
  if (isMultiplayer && (!outcome || !VALID_OUTCOMES.includes(outcome))) {
    return NextResponse.json(
      { error: "outcome required for multiplayer games" },
      { status: 400 },
    );
  }

  const pointsDelta = typeof score === "number" && Number.isFinite(score) ? score : 0;

  // High score count — single round trip via window function.
  // Sorts DESC games by score DESC, ASC games (e.g. Sudoku time) by
  // score ASC, then counts rank-1 rows belonging to this user.
  // Game IDs come from gameData.js (never user input) so embedding them
  // as a literal IN-list via sql.raw is safe and dodges Drizzle's
  // array-spread quirk where ${arr} expands to ($1,$2,...) which
  // Postgres reads as a tuple instead of an array — incompatible with
  // ANY(). IN (...) accepts the tuple form natively.
  const descIds = games.filter((g) => g.sortedOrder !== "ASC").map((g) => g.id);
  const ascIds = games.filter((g) => g.sortedOrder === "ASC").map((g) => g.id);
  // Guard against an empty list: IN () is a syntax error, so fall back
  // to a sentinel value no game id can ever have.
  const descList = sql.raw(`(${descIds.length > 0 ? descIds.join(",") : "-1"})`);
  const ascList = sql.raw(`(${ascIds.length > 0 ? ascIds.join(",") : "-1"})`);

  const hsResult = await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count FROM (
      SELECT user_id,
        row_number() OVER (
          PARTITION BY game_id
          ORDER BY
            CASE WHEN game_id IN ${descList} THEN score END DESC,
            CASE WHEN game_id IN ${ascList} THEN score END ASC,
            achieved_at ASC
        ) AS rn
      FROM ${bestScoresForGame}
    ) ranked
    WHERE rn = 1 AND user_id = ${userId};
  `);
  const hsRow =
    (hsResult as unknown as { rows?: Array<{ count: number }> }).rows?.[0] ??
    (hsResult as unknown as Array<{ count: number }>)[0];
  const highScoreCount = hsRow?.count ?? 0;

  const now = new Date();

  // Build the set of changes based on game type and outcome.
  if (isMultiplayer) {
    const incWin = outcome === "win" ? 1 : 0;
    const incLoss = outcome === "loss" ? 1 : 0;
    const incDraw = outcome === "draw" ? 1 : 0;
    const incForfeit = outcome === "forfeit" ? 1 : 0;

    await db
      .insert(userStatsTable)
      .values({
        userId,
        gamesWon: incWin,
        gamesLost: incLoss,
        gamesDrawn: incDraw,
        forfeits: incForfeit,
        pointsWon: pointsDelta,
        highScore: highScoreCount,
        currentWinStreak: incWin,
        longestWinStreak: incWin,
        firstPlayedAt: now,
        lastPlayedAt: now,
      })
      .onConflictDoUpdate({
        target: userStatsTable.userId,
        set: {
          gamesWon: sql`${userStatsTable.gamesWon} + ${incWin}`,
          gamesLost: sql`${userStatsTable.gamesLost} + ${incLoss}`,
          gamesDrawn: sql`${userStatsTable.gamesDrawn} + ${incDraw}`,
          forfeits: sql`${userStatsTable.forfeits} + ${incForfeit}`,
          pointsWon: sql`${userStatsTable.pointsWon} + ${pointsDelta}`,
          highScore: highScoreCount,
          // Wins extend the streak; anything else resets it. Longest
          // streak only ever climbs.
          currentWinStreak:
            incWin === 1
              ? sql`${userStatsTable.currentWinStreak} + 1`
              : sql`0`,
          longestWinStreak:
            incWin === 1
              ? sql`GREATEST(${userStatsTable.longestWinStreak}, ${userStatsTable.currentWinStreak} + 1)`
              : userStatsTable.longestWinStreak,
          lastPlayedAt: now,
          updatedAt: now,
        },
      });
  } else {
    // Singleplayer: just count games played.
    await db
      .insert(userStatsTable)
      .values({
        userId,
        gamesPlayed: 1,
        pointsWon: pointsDelta,
        highScore: highScoreCount,
        firstPlayedAt: now,
        lastPlayedAt: now,
      })
      .onConflictDoUpdate({
        target: userStatsTable.userId,
        set: {
          gamesPlayed: sql`${userStatsTable.gamesPlayed} + 1`,
          pointsWon: sql`${userStatsTable.pointsWon} + ${pointsDelta}`,
          highScore: highScoreCount,
          lastPlayedAt: now,
          updatedAt: now,
        },
      });
  }

  return NextResponse.json({ ok: true });
}
