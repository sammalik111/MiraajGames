// /api/games/[id]/multiplayer/moves
//
// One generic endpoint for every multiplayer game (TicTacToe, Battleship,
// Pool). The server is intentionally dumb: it stores opaque jsonb payloads
// in move-number order. Each game's client interprets and validates the
// payload locally.
//
// What the server DOES enforce:
//   - You're authenticated and a participant in the session.
//   - It's actually your turn (moveNumber % maxPlayers === your seat).
//   - moveNumber is the next slot (no skipping, no double-write).
//   - Strict-monotonic ordering via the (session_id, move_number) index.
//
// What the server does NOT enforce:
//   - That a TicTacToe cell isn't already taken, that a Battleship shot
//     hits, that a Pool shot makes geometric sense. Game-specific
//     correctness is enforced by the canonical move log on the client —
//     bad moves produce visibly bad replays for the other player, which
//     is a strong-enough deterrent for a hobby app.
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { db, gameMoves, gameParticipants, gameSessions } from "@/db";
import { makeId } from "@/lib/ids";

// ---- GET: fetch moves for a session, optionally since N --------------
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
  // Default since=-1 so move_number > -1 returns everything.
  const since = parseInt(url.searchParams.get("since") ?? "-1", 10);

  // Caller must be a participant. Cheaper than re-querying the session row.
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

  const moves = await db
    .select({
      moveNumber: gameMoves.moveNumber,
      senderId: gameMoves.senderId,
      payload: gameMoves.payload,
      createdAt: gameMoves.createdAt,
    })
    .from(gameMoves)
    .where(
      and(
        eq(gameMoves.gameSessionId, sessionId),
        gt(gameMoves.moveNumber, since),
      ),
    )
    .orderBy(asc(gameMoves.moveNumber));

  return NextResponse.json({ moves });
}

// ---- POST: submit a move ----------------------------------------------
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
  const claimedMoveNumber: number | undefined = body?.moveNumber;
  const payload = body?.payload;

  if (!sessionId || typeof claimedMoveNumber !== "number" || !payload) {
    return NextResponse.json(
      { error: "sessionId, moveNumber, and payload required" },
      { status: 400 },
    );
  }

  // One round-trip to fetch session + caller's seat. Not a join — two
  // small queries are cheaper than building a typed join here.
  const [session] = await db
    .select({
      maxPlayers: gameSessions.maxPlayers,
      isFull: gameSessions.isFull,
    })
    .from(gameSessions)
    .where(eq(gameSessions.id, sessionId))
    .limit(1);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const [me] = await db
    .select({ seat: gameParticipants.seat })
    .from(gameParticipants)
    .where(
      and(
        eq(gameParticipants.gameSessionId, sessionId),
        eq(gameParticipants.userId, userId),
      ),
    )
    .limit(1);
  if (!me) {
    return NextResponse.json({ error: "not a participant" }, { status: 403 });
  }
  if (!session.isFull) {
    return NextResponse.json(
      { error: "game hasn't started — waiting for players" },
      { status: 409 },
    );
  }

  // What's the next slot? = current move count.
  const [{ count: nextMoveNumber }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gameMoves)
    .where(eq(gameMoves.gameSessionId, sessionId));

  if (claimedMoveNumber !== nextMoveNumber) {
    // Client raced or fell behind — make them re-replay before retrying.
    return NextResponse.json(
      {
        error: "stale move number",
        expected: nextMoveNumber,
        got: claimedMoveNumber,
      },
      { status: 409 },
    );
  }

  // Whose turn is it? Round-robin by seat.
  const turnSeat = nextMoveNumber % session.maxPlayers;
  if (turnSeat !== me.seat) {
    return NextResponse.json(
      { error: "not your turn", whoseTurn: turnSeat, yourSeat: me.seat },
      { status: 403 },
    );
  }

  await db.insert(gameMoves).values({
    id: makeId(),
    gameSessionId: sessionId,
    senderId: userId,
    moveNumber: nextMoveNumber,
    payload,
  });

  return NextResponse.json({
    ok: true,
    moveNumber: nextMoveNumber,
  });
}
