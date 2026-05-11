import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, userFavorites, users, userStatsTable} from "@/db";
import { displayName } from "@/db/displayName";

// GET /api/auth/profile?userID=<id>
//
// Returns the public profile for any user — name, email, derived stats, and
// the list of favorited game ids — in a single round trip. Used by the
// /profile/[userID] page so it doesn't have to chain three fetches.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userID");
  if (!userId) {
    return NextResponse.json({ error: "userID required" }, { status: 400 });
  }

  // One row per user — name + email together so we don't fire two queries.
  const [userRow] = await db
    .select({ name: displayName, email: users.email, image: users.avatarUrl, createdDate: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  // Pull favorite game ids in one go. The list is also used to compute
  // favoriteCount, so no separate COUNT query needed.
  const favRows = await db
    .select({ gameId: userFavorites.gameId })
    .from(userFavorites)
    .where(eq(userFavorites.userId, userId));
  const favoriteIds = favRows.map((r) => r.gameId);


  const [userStats] = await db
  .select()
  .from(userStatsTable)
  .where(eq(userStatsTable.userId, userId))
  .limit(1);

  if (!userStats) {
    return NextResponse.json(
      { error: "User stats missing" },
      { status: 404 }
    );
  }

  const {
    gamesWon,
    gamesDrawn,
    gamesLost,
    forfeits,
    gamesPlayed,
    currentWinStreak,
    longestWinStreak,
    pointsWon,
    highScore,
  } = userStats;

  const multiPlayerGames = gamesWon + gamesDrawn + gamesLost + forfeits;
  const winRate = multiPlayerGames > 0
    ? Number(((gamesWon / multiPlayerGames) * 100).toFixed(2))
    : 0;
  const singlePlayerGames = gamesPlayed - multiPlayerGames;
  const accountAgeDays = userRow.createdDate
  ? Math.floor(
      (Date.now() - userRow.createdDate.getTime()) /
      (1000 * 60 * 60 * 24)
    )
  : 0;

  const stats = {
    singlePlayerGames,
    multiPlayerGames,
    winRate,
    currentStreak: currentWinStreak,
    longestStreak: longestWinStreak,
    accountAge: accountAgeDays,
    points: pointsWon,
    highScores: highScore,
  };

  return NextResponse.json({
    user: {
      id: userId,
      name: userRow.name ?? "Unknown User",
      email: userRow.email ?? "Unknown Email",
      image: userRow.image ?? null,
    },
    stats,
    favoriteIds,
  });
}
