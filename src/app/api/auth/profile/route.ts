import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { userFavorites } from "@/auth.config";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  const favoriteCount = userFavorites[userId]?.length ?? 0;

  const stats = {
    favoriteCount,
    gamesPlayed: favoriteCount * 3 + 5,
    achievements: Math.min(favoriteCount + 2, 12),
    points: favoriteCount * 125 + 500,
  };

  return NextResponse.json({
    user: {
      name: session.user.name,
      email: session.user.email,
    },
    stats,
  });
}
