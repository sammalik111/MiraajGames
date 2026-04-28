import { inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  getConversation,
  getMessages,
  isParticipant,
  leaveConversation,
  sendMessage,
} from "@/lib/messages";
import { db, users } from "@/db";

// GET /api/messages/[conversationId]?before=<ts>&limit=<n>
//
// Returns paginated messages, plus — on the initial load (no `before` cursor) —
// the conversation metadata with the other participants hydrated to {id,name}.
// The conversation page needs both on first load, so bundling them avoids a
// second round trip and a second authorization check.
//
// Subsequent pagination requests pass `?before=<ts>` and skip the conversation
// payload, since the caller already has it.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  if (!(await isParticipant(conversationId, userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = url.searchParams.get("limit");
  const page = await getMessages(conversationId, {
    before: before ? Number(before) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  if (before) return NextResponse.json(page);

  // Initial load — also return hydrated conversation metadata.
  const conv = await getConversation(conversationId);
  if (!conv) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const otherIds = conv.participants.filter((id) => id !== userId);
  const userRows = otherIds.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, otherIds))
    : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const otherUsers = otherIds.map((id) => {
    const u = userById.get(id);
    return { id, name: u?.name ?? u?.email ?? id };
  });

  return NextResponse.json({
    ...page,
    conversation: {
      id: conv.id,
      type: conv.type,
      name: conv.name,
      participants: conv.participants,
      otherUsers,
      lastMessageAt: conv.lastMessageAt,
      lastMessagePreview: conv.lastMessagePreview,
      lastMessageSenderId: conv.lastMessageSenderId,
    },
  });
}

// POST /api/messages/[conversationId]  { content }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  if (!(await isParticipant(conversationId, userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { content } = await req.json().catch(() => ({}));
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const message = await sendMessage({
    conversationId,
    senderId: userId,
    content: content.trim(),
  });
  return NextResponse.json({ message });
}

// DELETE /api/messages/[conversationId]
//
// "Leave" the conversation. Same shape across DMs and groups — the caller's
// participant row is removed; the conversation is fully dropped only when
// no one's left in it (which for DMs effectively means "the other side is
// already gone"). Group ownership hands off to the next-earliest joiner if
// the leaver was the creator. See leaveConversation() for the full policy.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  try {
    const result = await leaveConversation(conversationId, userId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if ((err as Error).message === "not a participant") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    console.error("Leave conversation error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
