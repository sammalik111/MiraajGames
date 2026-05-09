import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/requireUser";
import { db, feedbackTable , users} from "@/db";
import { displayName } from "@/db/displayName";
import { makeId } from "@/lib/ids";

export async function PUT(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (typeof userId !== "string") return userId;

    const username = await db.select({name: displayName }).from(users).where(eq(users.id,userId));
    const timestamp = new Date().toISOString();
    const { email, subject, message } = await req.json();
    
    if (!email || !subject || !message) {
      return NextResponse.json({ error: "Missing fields, please fill out required fields" }, { status: 400 });
    }

    await db.insert(feedbackTable).values({
        id: makeId(),
        createdBy: userId,
        email,
        subject,
        message,
    // createdAt omitted — defaults to now()
    });

    return NextResponse.json({ message: "Feedback submitted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Nickname update error:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}