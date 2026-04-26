import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getOrCreateDm } from "@/lib/messages";
import { db, userFriends } from "@/db";

// POST /api/messages/conversation  { friendId }
// Finds or creates a 1:1 conversation between the current user and friendId.
// Requires the two users to be friends — symmetric so we only need to check
// one direction.
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { friendId } = await req.json().catch(() => ({}));
  if (!friendId || typeof friendId !== "string") {
    return NextResponse.json({ error: "friendId required" }, { status: 400 });
  }

  const [link] = await db
    .select({ friendId: userFriends.friendId })
    .from(userFriends)
    .where(
      and(eq(userFriends.userId, userId), eq(userFriends.friendId, friendId)),
    )
    .limit(1);
  if (!link) {
    return NextResponse.json({ error: "not friends" }, { status: 403 });
  }

  const conv = await getOrCreateDm(userId, friendId);
  return NextResponse.json({ conversation: conv });
}
