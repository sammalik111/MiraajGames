import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ user: null }, { status: 404 });
  return NextResponse.json({ user: row });
}
