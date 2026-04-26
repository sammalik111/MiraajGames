import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getMessages, isParticipant, sendMessage } from "@/lib/messages";

// GET /api/messages/[conversationId]?before=<ts>&limit=<n>
// Paginated messages via keyset cursor on createdAt.
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
  return NextResponse.json(page);
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
