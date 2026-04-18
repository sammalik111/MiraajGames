
import { NextRequest, NextResponse } from "next/server";
import { userFavorites } from "@/auth.config";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const { gameId } = await req.json();
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id as string;
    if (!userFavorites[userId]) {
      userFavorites[userId] = [];
    }

    const isAlreadyFavorited = userFavorites[userId].includes(gameId);
    let action = "added";

    if (!isAlreadyFavorited) {
      userFavorites[userId].push(gameId);
    } else {
      userFavorites[userId] = userFavorites[userId].filter(id => id !== gameId);
      action = "removed";
    }

    return NextResponse.json(
      { message: `Game ${action} ${isAlreadyFavorited ? "from" : "to"} favorites`, favorites: userFavorites[userId], action },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error adding to favorites:", error);
    return NextResponse.json(
      { error: "Failed to add to favorites" },
      { status: 500 }
    );
  }
}
