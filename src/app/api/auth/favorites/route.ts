import { NextResponse } from "next/server";
import { db, userFavorites } from "@/db";

// Returns every user's favorites grouped by user. Used by the GameCard
// component to seed `favoriteIds` for any logged-in user.
//
// Note: this is O(N) over all favorites — fine at our scale, but if we ever
// have many users we should switch the consumer to call /favorites/me and
// only return the current user's list.
export async function GET() {
  const rows = await db
    .select({ userId: userFavorites.userId, gameId: userFavorites.gameId })
    .from(userFavorites);

  // Group rows into { userId, favorites: gameId[] } shape the UI expects.
  const byUser = new Map<string, number[]>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r.gameId);
    byUser.set(r.userId, list);
  }
  const favorites = Array.from(byUser, ([userId, favs]) => ({
    userId,
    favorites: favs,
  }));

  return NextResponse.json({ total: favorites.length, favorites });
}
