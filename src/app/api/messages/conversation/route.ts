import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getOrCreateDm, createGroup} from "@/lib/messages";
import { db, userFriends } from "@/db";
import { escape } from "querystring";

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

  const { friendIds } = await req.json().catch(() => ({}));
  if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
    return NextResponse.json({ error: "friendIds cannot be empty" }, { status: 400 });
  }

  if (friendIds.length === 1) {
    const [link] = await db
      .select({ friendId: userFriends.friendId })
      .from(userFriends)
      .where(
        and(eq(userFriends.userId, userId), eq(userFriends.friendId, friendIds[0])),
      )
      .limit(1);
    if (!link) {
      return NextResponse.json({ error: "not friends" }, { status: 403 });
    }

    const conv = await getOrCreateDm(userId, friendIds[0]);
    return NextResponse.json({ conversation: conv });
  }
  else if (friendIds.length > 1) {
    const groupName = `Group: ${friendIds.map(id => escape(id)).join(", ")}`; 
    const conv = await createGroup(userId, friendIds, { name: groupName });
    return NextResponse.json({ conversation: conv });
  }

  return NextResponse.json({ error: "invalid friendIds" }, { status: 400 });
}
