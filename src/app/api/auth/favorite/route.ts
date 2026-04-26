import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, userFavorites } from "@/db";

// Toggle a game in/out of the user's favorites.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await req.json();
    if (typeof gameId !== "number") {
      return NextResponse.json({ error: "gameId required" }, { status: 400 });
    }

    const userId = session.user.id as string;

    // Probe before mutating so we know which action we took (the UI uses this
    // to flip the ★ state and choose the toast text).
    const [existing] = await db
      .select({ gameId: userFavorites.gameId })
      .from(userFavorites)
      .where(and(eq(userFavorites.userId, userId), eq(userFavorites.gameId, gameId)))
      .limit(1);

    let action: "added" | "removed";
    if (existing) {
      await db
        .delete(userFavorites)
        .where(and(eq(userFavorites.userId, userId), eq(userFavorites.gameId, gameId)));
      action = "removed";
    } else {
      await db.insert(userFavorites).values({ userId, gameId });
      action = "added";
    }

    // Return the fresh list so callers can reconcile without a second fetch.
    const rows = await db
      .select({ gameId: userFavorites.gameId })
      .from(userFavorites)
      .where(eq(userFavorites.userId, userId));
    const favorites = rows.map((r) => r.gameId);

    return NextResponse.json(
      {
        message: `Game ${action} ${action === "removed" ? "from" : "to"} favorites`,
        favorites,
        action,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return NextResponse.json({ error: "Failed to update favorites" }, { status: 500 });
  }
}
