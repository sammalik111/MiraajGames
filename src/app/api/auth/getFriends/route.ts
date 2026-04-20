import { userFriends, users } from "@/auth.config";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

interface Friend {
    id: string;
    name: string;
}

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            console.log("No user session found.");
            return NextResponse.json({ friends: [] });
        }

        const userId = session.user.id as string;
        console.log("User ID from session:", userId);
        let friendIds: string[] = [];
        for (const [key, friends] of Object.entries(userFriends)) {
            if (key === userId) {
                friendIds = friends;
                break;
            }
        }
        console.log("Friend IDs for current user:", friendIds);

        let friends: Friend[] = [];
        let allUsers = users as any[];
        for (const friendId of friendIds) {
            const thisUsersFriends = allUsers.find((u: any) => u.id === friendId);
            if (thisUsersFriends) {
                friends.push({ id: thisUsersFriends.id, name: thisUsersFriends.name });
            }
        }
        console.log("Friends data:", friends);
        return NextResponse.json({ friends });


    } catch (error) {
        console.error("Error retrieving friends:", error);
        return NextResponse.json({ friends: [] });
    }
}