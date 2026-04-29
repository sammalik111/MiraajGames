import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/requireUser";
import { db, users } from "@/db";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (typeof userId !== "string") return userId;

    const { inputData } = await req.json();
    if (!inputData) {
      return NextResponse.json({ error: "New avatar URL is required" }, { status: 400 });
    }

    // validation to ensure inputData is a valid URL and possibly check if it's an image URL.
    if (typeof inputData !== "string" || !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|avif|svg)$/.test(inputData)) {
      return NextResponse.json({ error: "Invalid avatar URL format" }, { status: 400 });
    }

    await db.update(users).set({ avatarUrl: inputData }).where(eq(users.id, userId));

    return NextResponse.json({ message: "Avatar updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Avatar update error:", error);
    return NextResponse.json({ error: "Failed to update Avatar" }, { status: 500 });
  }
}

// delete avatar 
export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (typeof userId !== "string") return userId;


    await db.update(users).set({ avatarUrl: null }).where(eq(users.id, userId));

    return NextResponse.json({ message: "Avatar deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Avatar delete error:", error);
    return NextResponse.json({ error: "Failed to delete Avatar" }, { status: 500 });
  }
}