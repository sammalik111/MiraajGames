import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userFriends } from "@/db";

// POST { friendId } — removes both rows of the symmetric pair.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id as string;

    const body = await request.json().catch(() => ({}));
    const friendId = (body.friendId ?? body.userId) as string | undefined;
    if (!friendId) {
      return NextResponse.json(
        { success: false, message: "Missing friendId" },
        { status: 400 },
      );
    }

    // Single DELETE that nukes both directions of the friendship.
    await db
      .delete(userFriends)
      .where(
        or(
          and(eq(userFriends.userId, userId), eq(userFriends.friendId, friendId)),
          and(eq(userFriends.userId, friendId), eq(userFriends.friendId, userId)),
        ),
      );

    const remaining = await db
      .select({ friendId: userFriends.friendId })
      .from(userFriends)
      .where(eq(userFriends.userId, userId));

    return NextResponse.json(
      { success: true, friends: remaining.map((r) => r.friendId) },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error removing friend:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
