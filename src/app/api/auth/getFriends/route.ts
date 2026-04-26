import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, users, userFriends } from "@/db";

// Returns the current user's friends with id + display name.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ friends: [] });
    }
    const userId = session.user.id as string;

    // One join — pull the friend row + their user record in a single query.
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(userFriends)
      .innerJoin(users, eq(users.id, userFriends.friendId))
      .where(eq(userFriends.userId, userId));

    const friends = rows.map((r) => ({
      id: r.id,
      // Fall back to email if no display name set, matching the old behavior.
      name: r.name ?? r.email,
    }));

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("Error retrieving friends:", error);
    return NextResponse.json({ friends: [] });
  }
}
