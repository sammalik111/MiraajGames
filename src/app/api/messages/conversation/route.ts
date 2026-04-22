import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getOrCreateDm } from "@/lib/messages";
import { userFriends } from "@/auth.config";

// POST /api/messages/conversation  { friendId }
// Finds or creates a 1:1 conversation between the current user and friendId.
export async function POST(req: Request) {
    const session = await auth();
    const userId = session?.user?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { friendId } = await req.json().catch(() => ({}));
    console.log(`Finding or creating conversation between ${userId} and ${friendId}`);
    if (!friendId || typeof friendId !== "string") {
        return NextResponse.json({ error: "friendId required" }, { status: 400 });
    }

    console.log(`Checking if ${userId} and ${friendId} are friends`);
    const friends = userFriends[userId] ?? [];
    if (!friends.includes(friendId)) {
        return NextResponse.json({ error: "not friends" }, { status: 403 });
    }

    
    const conv = getOrCreateDm(userId, friendId);
    return NextResponse.json({ conversation: conv });
}