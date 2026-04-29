import { requireUser } from "@/lib/requireUser";
import { NextResponse } from "next/server";
import { isParticipant, markRead } from "@/lib/messages";

// POST /api/messages/[conversationId]/read — resets unread counter for the caller.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const { conversationId } = await params;
  if (!(await isParticipant(conversationId, userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await markRead(conversationId, userId);
  return NextResponse.json({ ok: true });
}
