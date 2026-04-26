import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db, userFavorites } from "@/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  // Single COUNT query — Postgres can answer it from the PK index alone.
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userFavorites)
    .where(eq(userFavorites.userId, userId));
  const favoriteCount = row?.count ?? 0;

  // The "stats" are still derived placeholders — wire them to real
  // game-play tables when those exist.
  const stats = {
    favoriteCount,
    gamesPlayed: favoriteCount * 3 + 5,
    achievements: Math.min(favoriteCount + 2, 12),
    points: favoriteCount * 125 + 500,
  };

  return NextResponse.json({
    user: { name: session.user.name, email: session.user.email },
    stats,
  });
}
