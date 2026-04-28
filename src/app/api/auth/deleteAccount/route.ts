import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users } from "@/db";

// DELETE /api/auth/deleteAccount  { inputData: <plaintext password> }
//
// Verifies the password against the *session* user (we don't trust a userId
// from the body — that would let anyone with a stolen password delete any
// account they could name).
//
// All cleanup happens at the schema level via FK cascades (see schema.ts):
//   CASCADE  → user_favorites, user_friends,
//              conversation_participants, message_reactions
//   SET NULL → conversations.created_by, conversations.last_message_sender_id,
//              messages.sender_id   (history survives, sender shows as null)
//
// So a single DELETE on `users` is enough.
export async function DELETE(request: Request) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { inputData } = await request.json().catch(() => ({}));
  if (typeof inputData !== "string" || !inputData) {
    return new Response(JSON.stringify({ error: "Password required" }), { status: 400 });
  }

  try {
    const [thisUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!thisUser) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    // bcrypt.compare(plaintext, hash) — never compare two hashes; bcrypt
    // salts every hash differently so hash(x) !== hash(x).
    const ok = await bcrypt.compare(inputData, thisUser.passwordHash);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Incorrect password" }), { status: 401 });
    }

    await db.delete(users).where(eq(users.id, userId));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Account deletion error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred during account deletion" }),
      { status: 500 },
    );
  }
}
