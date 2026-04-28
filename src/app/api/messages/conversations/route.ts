import { inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { listConversationsForUser } from "@/lib/messages";
import { db, users } from "@/db";

// GET /api/messages/conversations
// Returns the user's inbox with denormalized previews and unread counts.
// Each entry is enriched with `otherUsers` (id + display name) so the UI
// can render avatars and titles without a follow-up fetch per row.
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ conversations: [] });

  const entries = await listConversationsForUser(userId);

  // Collect the full set of "other" user ids across all conversations and
  // hydrate them in a single IN-query — avoids N+1.
  const otherIdSet = new Set<string>();
  for (const { conversation } of entries) {
    for (const id of conversation.participants) {
      if (id !== userId) otherIdSet.add(id);
    }
  }

  const otherIds = [...otherIdSet];
  const userRows = otherIds.length
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(inArray(users.id, otherIds))
    : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const payload = entries.map(({ conversation, state }) => ({
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    participants: conversation.participants,
    otherUsers: conversation.participants
      .filter((id) => id !== userId)
      .map((id) => {
        const u = userById.get(id);
        return { id, name: u?.name ?? u?.email ?? id };
      }),
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageSenderId: conversation.lastMessageSenderId,
    unreadCount: state.unreadCount,
    muted: state.muted,
  }));

  return NextResponse.json({ conversations: payload });
}
