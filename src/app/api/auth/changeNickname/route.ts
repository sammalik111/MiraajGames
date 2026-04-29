import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/requireUser";
import { db, users } from "@/db";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (typeof userId !== "string") return userId;

    const { newNickname } = await req.json();
    if (!newNickname) {
      return NextResponse.json({ error: "New nickname is required" }, { status: 400 });
    }

    await db.update(users).set({ nickname: newNickname }).where(eq(users.id, userId));

    return NextResponse.json({ message: "Nickname updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Nickname update error:", error);
    return NextResponse.json({ error: "Failed to update Nickname" }, { status: 500 });
  }
}

// delete nickname 
export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (typeof userId !== "string") return userId;


    await db.update(users).set({ nickname: null }).where(eq(users.id, userId));

    return NextResponse.json({ message: "Nickname deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Nickname delete error:", error);
    return NextResponse.json({ error: "Failed to delete Nickname" }, { status: 500 });
  }
}