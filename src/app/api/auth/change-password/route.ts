import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/requireUser";
import { db, users } from "@/db";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (typeof userId !== "string") return userId;

    const { currentPassword, newPassword, confirmPassword } = await req.json();
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const nextHash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash: nextHash }).where(eq(users.id, userId));

    return NextResponse.json({ message: "Password updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
