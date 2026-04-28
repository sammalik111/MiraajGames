import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getOrCreateDm, createGroup } from "@/lib/messages";
import { db, userFriends, users } from "@/db";

// POST /api/messages/conversation  { friendIds: string[] }
//
// One slot for opening either a DM (length 1) or a group (length > 1). For a
// DM we re-use any existing 1:1 (idempotent via the deterministic dm_<a>_<b>
// id in lib/messages.ts). For a group we snapshot a stable display name from
// the joined member display names so it doesn't drift later when someone
// leaves and otherUsers changes.
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

  // Group — look up display names so the snapshot reads like
  // "Alice, Bob, Carol" instead of "Group: 7f3a..., 9b21...". Names come
  // from `name`, falling back to `email` to match the rest of the UI.
  const memberIds = Array.from(new Set([userId, ...friendIds]));
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, memberIds));
  const byId = new Map(rows.map((r) => [r.id, r.name ?? r.email ?? r.id]));
  const groupName = memberIds
    .map((id) => byId.get(id) ?? id)
    .join(", ");

  const conv = await createGroup(userId, friendIds, { name: groupName });
  return NextResponse.json({ conversation: conv });
}
