// /api/games/[id]/multiplayer/moves
//
// Generic ordered event log for every multiplayer game. Server is dumb:
// it accepts any payload from any participant and appends at the next
// slot. Each game's CLIENT enforces its own rules (turn alternation,
// move legality, etc.). Server only enforces:
//   - You're authenticated and in the session.
//   - Game has started (room.isFull) — except for `game-start` itself,
//     which is what flips that bit in spirit.
//
// We dropped the per-move turn-rotation guard because it conflated
// gameplay-only counts with total-row counts (meta payloads like
// `game-start` and `rematch-vote` were poisoning the modulo math). Each
// game already filters meta payloads when it computes turn locally, so
// putting the same logic on both ends just made bugs.
//
// Caching:
//   GET supports `?lastCount=N`. If the current row count for the
//   session equals N, the server returns `{ count, unchanged: true }`
//   and skips the actual moves SELECT. Cache hits do a single COUNT
//   query (parallel with the membership check) and ship a tiny payload.
import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { db, gameMoves, gameParticipants, gameSessions } from "@/db";
import { makeId } from "@/lib/ids";

function hasTypeField(p: unknown): p is { type: string } {
  return (
    typeof p === "object" &&
    p !== null &&
    "type" in p &&
    typeof (p as { type: unknown }).type === "string"
  );
}

// ---- DELETE ----------------------------------------------------------
// Default: wipe every move in the session (rematch flow).
// `?onlyMyVote=true`: wipe only the caller's rematch-vote rows.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const { id: gameid } = await params;
  if (Number.isNaN(parseInt(gameid, 10))) {
    return NextResponse.json({ error: "invalid game id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const onlyMyVote = url.searchParams.get("onlyMyVote") === "true";

  const [member] = await db
    .select({ userId: gameParticipants.userId })
    .from(gameParticipants)
    .where(
      and(
        eq(gameParticipants.gameSessionId, sessionId),
        eq(gameParticipants.userId, userId),
      ),
    )
    .limit(1);
  if (!member) {
    return NextResponse.json({ error: "not a participant" }, { status: 403 });
  }

  if (onlyMyVote) {
    await db
      .delete(gameMoves)
      .where(
        and(
          eq(gameMoves.gameSessionId, sessionId),
          eq(gameMoves.senderId, userId),
          sql`${gameMoves.payload}->>'type' = 'rematch-vote'`,
        ),
      );
    return NextResponse.json({ ok: true, mode: "vote-only" });
  }

  await db.delete(gameMoves).where(eq(gameMoves.gameSessionId, sessionId));
  return NextResponse.json({ ok: true, mode: "full" });
}

// ---- GET ------------------------------------------------------------
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const { id: gameid } = await params;
  if (Number.isNaN(parseInt(gameid, 10))) {
    return NextResponse.json({ error: "invalid game id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const lastCount = parseInt(url.searchParams.get("lastCount") ?? "-1", 10);

  // Membership check + row count in parallel. Both are tiny, indexed.
  const [memberCheck, countResult] = await Promise.all([
    db
      .select({ userId: gameParticipants.userId })
      .from(gameParticipants)
      .where(
        and(
          eq(gameParticipants.gameSessionId, sessionId),
          eq(gameParticipants.userId, userId),
        ),
      )
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(gameMoves)
      .where(eq(gameMoves.gameSessionId, sessionId)),
  ]);

  if (memberCheck.length === 0) {
    return NextResponse.json({ error: "not a participant" }, { status: 403 });
  }

  const count = countResult[0].count;

  // Cache hit — nothing changed since the client last polled. Return a
  // tiny payload and skip the moves SELECT entirely.
  if (count === lastCount) {
    return NextResponse.json({ count, unchanged: true });
  }

  const moves = await db
    .select({
      moveNumber: gameMoves.moveNumber,
      senderId: gameMoves.senderId,
      payload: gameMoves.payload,
      createdAt: gameMoves.createdAt,
    })
    .from(gameMoves)
    .where(eq(gameMoves.gameSessionId, sessionId))
    .orderBy(asc(gameMoves.moveNumber));

  return NextResponse.json({ count, moves });
}

// ---- POST -----------------------------------------------------------
// Server appends at the next slot. No turn validation, no staleness
// validation — that's the client's job per game.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const { id: gameid } = await params;
  if (Number.isNaN(parseInt(gameid, 10))) {
    return NextResponse.json({ error: "invalid game id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId: string | undefined = body?.sessionId;
  const payload = body?.payload;
  if (!sessionId || !payload) {
    return NextResponse.json(
      { error: "sessionId and payload required" },
      { status: 400 },
    );
  }

  const typed = hasTypeField(payload);
  const isGameStart = typed && payload.type === "game-start";
  const isRematchVote = typed && payload.type === "rematch-vote";

  // Session + seat in parallel (we don't need seat anymore for turn
  // validation, but we still want to confirm membership).
  const [sessionRows, meRows] = await Promise.all([
    db
      .select({
        maxPlayers: gameSessions.maxPlayers,
        isFull: gameSessions.isFull,
      })
      .from(gameSessions)
      .where(eq(gameSessions.id, sessionId))
      .limit(1),
    db
      .select({ seat: gameParticipants.seat })
      .from(gameParticipants)
      .where(
        and(
          eq(gameParticipants.gameSessionId, sessionId),
          eq(gameParticipants.userId, userId),
        ),
      )
      .limit(1),
  ]);

  const session = sessionRows[0];
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (meRows.length === 0) {
    return NextResponse.json({ error: "not a participant" }, { status: 403 });
  }
  // game-start is the signal that gameplay should begin; allow it even
  // if isFull just flipped.
  if (!session.isFull && !isGameStart) {
    return NextResponse.json(
      { error: "game hasn't started — waiting for players" },
      { status: 409 },
    );
  }

  // Block double-voting (cheap scan over the small move list).
  if (isRematchVote) {
    const existing = await db
      .select({ senderId: gameMoves.senderId, payload: gameMoves.payload })
      .from(gameMoves)
      .where(eq(gameMoves.gameSessionId, sessionId));
    const alreadyVoted = existing.some(
      (m) =>
        m.senderId === userId &&
        (m.payload as Record<string, unknown>)?.type === "rematch-vote",
    );
    if (alreadyVoted) {
      return NextResponse.json(
        { error: "you already voted to rematch" },
        { status: 409 },
      );
    }
  }

  // Pick the next absolute slot.
  const [{ count: nextMoveNumber }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gameMoves)
    .where(eq(gameMoves.gameSessionId, sessionId));

  await db.insert(gameMoves).values({
    id: makeId(),
    gameSessionId: sessionId,
    senderId: userId,
    moveNumber: nextMoveNumber,
    payload,
  });

  return NextResponse.json({ ok: true, moveNumber: nextMoveNumber });
}
