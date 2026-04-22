import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { listConversationsForUser } from "@/lib/messages";
import { users } from "@/auth.config";

// GET /api/messages/conversations
// Returns the user's inbox with denormalized previews and unread counts.
export async function GET() {
    const session = await auth();
    const userId = session?.user?.id as string | undefined;
    if (!userId) return NextResponse.json({ conversations: [] });

    const entries = listConversationsForUser(userId);
    const usersArr = users as Array<{ id: string; name?: string; email: string }>;

    const payload = entries.map(({ conversation, state }) => {
        const otherIds = conversation.participants.filter((id) => id !== userId);
        const otherUsers = otherIds.map((id) => {
        const u = usersArr.find((x) => x.id === id);
        return { id, name: u?.name ?? u?.email ?? id };
        });
        return {
        id: conversation.id,
        type: conversation.type,
        participants: conversation.participants,
        otherUsers,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        lastMessageSenderId: conversation.lastMessageSenderId,
        unreadCount: state.unreadCount,
        muted: state.muted,
        };
    });

    return NextResponse.json({ conversations: payload });
}