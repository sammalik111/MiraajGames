import { NextResponse } from "next/server";
import { db, users } from "@/db";

// Returns all users without passwords. Used by debugging tools — not exposed
// in any UI. If this ever gets a UI consumer, add `auth()` + a role check.
export async function GET() {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    })
    .from(users);

  return NextResponse.json({ total: rows.length, users: rows });
}
