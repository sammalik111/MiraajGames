
import { userFriends } from "@/auth.config";
import { NextResponse } from "next/server";


export async function POST(request: Request) {
    try {
        const { userId, friendId } = await request.json();

        if (!userId || !friendId) {
            return NextResponse.json({ success: false, message: "Missing userId or friendId" }, { status: 400 });
        }

        if (!userFriends[userId]) {
            userFriends[userId] = [];
        }

        if (!userFriends[userId].includes(friendId)) {
            userFriends[userId].push(friendId);
        }
        // also add the current user to the friend's list to make it mutual
        if (!userFriends[friendId]) {
            userFriends[friendId] = [];
        }
        if (!userFriends[friendId].includes(userId)) {
            userFriends[friendId].push(userId);
        }

        //  return the new friend list for the user after adding the friend (optional, can be used to update the UI immediately)
        const newFriendList = userFriends[userId];
        return NextResponse.json({ success: true, friends: newFriendList }, { status: 200 } );
    } catch (error) {
        console.error("Error adding friend:", error);
        return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
    }
}