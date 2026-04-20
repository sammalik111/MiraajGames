import { userFriends } from "@/auth.config";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { userId, friendId } = await request.json();

        if (!userId || !friendId) {
            return NextResponse.json({ success: false, message: "Missing userId or friendId" }, { status: 400 });
        }

        if (userFriends[userId]) {
            userFriends[userId] = userFriends[userId].filter(id => id !== friendId);
        }
        // also remove the current user from the friend's list to make it mutual
        if (userFriends[friendId]) {
            userFriends[friendId] = userFriends[friendId].filter(id => id !== userId);
        }

        //  return the new friend list for the user after removing the friend (optional, can be used to update the UI immediately)
        const newFriendList = userFriends[userId] || [];
        return NextResponse.json({ success: true, friends: newFriendList }, { status: 200 } );
    } catch (error) {
        console.error("Error removing friend:", error);
        return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
    }
}