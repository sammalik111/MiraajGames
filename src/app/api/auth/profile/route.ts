import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, userFavorites, users } from "@/db";

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
    .select({ name: users.name, email: users.email })
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

  // The "stats" are still derived placeholders — wire them to real
  // game-play tables when those exist.
  const favoriteCount = favoriteIds.length;
  const stats = {
    favoriteCount,
    gamesPlayed: favoriteCount * 3 + 5,
    achievements: Math.min(favoriteCount + 2, 12),
    points: favoriteCount * 125 + 500,
  };

  return NextResponse.json({
    user: {
      id: userId,
      name: userRow.name ?? "Unknown User",
      email: userRow.email ?? "Unknown Email",
    },
    stats,
    favoriteIds,
  });
}
