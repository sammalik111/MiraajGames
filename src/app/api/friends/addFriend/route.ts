import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, users, userFriends } from "@/db";

// POST { friendId } — adds a symmetric friendship row in both directions.
// We trust the session for the requester's id rather than letting the client
// submit a `userId` (the old route did, which would let anyone friend anyone
// to anyone else if they knew the ids).
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id as string;

    const body = await request.json().catch(() => ({}));
    const friendId = (body.friendId ?? body.userId) as string | undefined;
    // Note: kept `body.userId` as a fallback so the existing UI keeps working,
    // but the *trusted* requester id is always the session user id.

    if (!friendId || friendId === userId) {
      return NextResponse.json(
        { success: false, message: "Invalid friendId" },
        { status: 400 },
      );
    }

    // Verify the target actually exists (FK would catch this, but a 404 is
    // friendlier than a 500).
    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, friendId))
      .limit(1);
    if (!target) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    // Insert both directions. ON CONFLICT DO NOTHING makes the call idempotent
    // — re-adding an existing friend is a no-op instead of an error.
    await db
      .insert(userFriends)
      .values([
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ])
      .onConflictDoNothing();

    const friends = await db
      .select({ friendId: userFriends.friendId })
      .from(userFriends)
      .where(eq(userFriends.userId, userId));

    return NextResponse.json(
      { success: true, friends: friends.map((f) => f.friendId) },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error adding friend:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
