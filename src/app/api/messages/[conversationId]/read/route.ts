import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { isParticipant, markRead } from "@/lib/messages";

// POST /api/messages/[conversationId]/read — resets unread counter for the caller.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  if (!(await isParticipant(conversationId, userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await markRead(conversationId, userId);
  return NextResponse.json({ ok: true });
}
