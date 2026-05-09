// GET    /api/admin/Dashboards         — full dashboard payload
// DELETE /api/admin/Dashboards?userId=X — remove a user account
//
// Both gated by `requireAdmin` (process.env.ADMIN_IDS allow-list).

import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  db,
  users,
  feedbackTable,
  conversations,
  messages,
  gameScores,
  gameSessions,
} from "@/db";
import { displayName } from "@/db/displayName";

// ---- GET ---------------------------------------------------------------
export async function GET() {
  const adminId = await requireAdmin();
  if (typeof adminId !== "string") return adminId;

  // Run the small reads in parallel — every query is a single index seek
  // or a tiny COUNT, so concurrency makes the round-trip cost-bound.
  const [
    feedbackRows,
    userRows,
    [{ totalUsers }],
    [{ usersLast7 }],
    [{ totalFeedback }],
    [{ totalScores }],
    [{ totalSessions }],
    [{ activeSessions }],
    [{ totalMessages }],
    [{ totalConversations }],
  ] = await Promise.all([
    // Feedback joined with submitter's display name, newest first.
    db
      .select({
        id: feedbackTable.id,
        createdBy: feedbackTable.createdBy,
        submitterName: displayName,
        email: feedbackTable.email,
        subject: feedbackTable.subject,
        message: feedbackTable.message,
        createdAt: feedbackTable.createdAt,
      })
      .from(feedbackTable)
      .leftJoin(users, eq(users.id, feedbackTable.createdBy))
      .orderBy(desc(feedbackTable.createdAt)),

    // All users ordered newest first.
    db
      .select({
        id: users.id,
        name: users.name,
        nickname: users.nickname,
        email: users.email,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt)),

    // Aggregate counts. Each runs as a tiny indexed COUNT.
    db.select({ totalUsers: sql<number>`count(*)::int` }).from(users),
    db
      .select({
        usersLast7: sql<number>`count(*) filter (where ${users.createdAt} > now() - interval '7 days')::int`,
      })
      .from(users),
    db
      .select({ totalFeedback: sql<number>`count(*)::int` })
      .from(feedbackTable),
    db.select({ totalScores: sql<number>`count(*)::int` }).from(gameScores),
    db
      .select({ totalSessions: sql<number>`count(*)::int` })
      .from(gameSessions),
    db
      .select({
        activeSessions: sql<number>`count(*) filter (where ${gameSessions.isFull})::int`,
      })
      .from(gameSessions),
    db.select({ totalMessages: sql<number>`count(*)::int` }).from(messages),
    db
      .select({ totalConversations: sql<number>`count(*)::int` })
      .from(conversations),
  ]);

  return NextResponse.json({
    stats: {
      users: { total: totalUsers, newLast7Days: usersLast7 },
      feedback: { total: totalFeedback },
      games: {
        scoresSubmitted: totalScores,
        sessionsTotal: totalSessions,
        sessionsActive: activeSessions,
      },
      messages: {
        total: totalMessages,
        conversations: totalConversations,
      },
    },
    feedback: feedbackRows,
    users: userRows,
    currentAdminId: adminId,
  });
}

// ---- DELETE ?userId=X --------------------------------------------------
// Remove a user account. CASCADE on FKs handles their favorites, friends,
// participants, scores, messages-sender (set null), feedback (cascade).
// Refuses to delete the calling admin to avoid an instant lockout.
export async function DELETE(req: NextRequest) {
  const adminId = await requireAdmin();
  if (typeof adminId !== "string") return adminId;

  const url = new URL(req.url);
  const targetId = url.searchParams.get("userId");
  if (!targetId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (targetId === adminId) {
    return NextResponse.json(
      { error: "you can't delete your own admin account from here" },
      { status: 400 },
    );
  }

  const result = await db
    .delete(users)
    .where(eq(users.id, targetId))
    .returning({ id: users.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, deletedId: result[0].id });
}
