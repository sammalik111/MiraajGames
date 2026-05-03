import { eq, and, sql, asc } from "drizzle-orm";
import { requireUser } from "@/lib/requireUser";
import { NextResponse } from "next/server";
import { db, gameSessions, gameParticipants, users } from "@/db";
import { displayName } from "@/db/displayName";

// ---- /api/games/[id]/multiplayer/gameRoom


// create a unique ID for the roomID for this game
function hashStrings(str1: string, str2: string): number {
  const combined = `${str1}|${str2}`;
  let hash = 5381;

  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) + hash + combined.charCodeAt(i);
    hash |= 0;
  }

  return hash >>> 0;
}


// ---- Shared helper -----------------------------------------------------
// Every handler returns the same shape: room metadata + the participant
// list. The lobby UI renders the same view regardless of which action just
// happened (create / join / refresh).
async function getRoomSnapshot(roomId: string) {
  const [room] = await db
    .select({
      id: gameSessions.id,
      gameId: gameSessions.gameId,
      public: gameSessions.public,
      isFull: gameSessions.isFull,
      maxPlayers: gameSessions.maxPlayers,
      createdBy: gameSessions.createdBy,
      createdAt: gameSessions.createdAt,
    })
    .from(gameSessions)
    .where(eq(gameSessions.id, roomId))
    .limit(1);

  if (!room) return null;

  const participants = await db
    .select({
      userId: gameParticipants.userId,
      name: displayName,
      seat: gameParticipants.seat,
      joinedAt: gameParticipants.joinedAt,
    })
    .from(gameParticipants)
    .leftJoin(users, eq(users.id, gameParticipants.userId))
    .where(eq(gameParticipants.gameSessionId, roomId))
    .orderBy(asc(gameParticipants.seat));

  return { room, participants };
}


// ---- GET: am I already in a room for this game? -----------------------
// Lets the lobby auto-repopulate after a logout/refresh. Returns the room
// snapshot if the user is a current participant, 204 otherwise.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const { id: gameid } = await params;
  const gameIdNum = parseInt(gameid, 10);
  if (Number.isNaN(gameIdNum)) {
    return NextResponse.json({ error: "invalid game id" }, { status: 400 });
  }

  // Find the (single) session this user is currently a participant in
  // for this game. If they're somehow in multiple, take the most recent.
  const [hit] = await db
    .select({ id: gameSessions.id })
    .from(gameParticipants)
    .innerJoin(gameSessions, eq(gameSessions.id, gameParticipants.gameSessionId))
    .where(
      and(
        eq(gameParticipants.userId, userId),
        eq(gameSessions.gameId, gameIdNum),
      ),
    )
    .orderBy(sql`${gameParticipants.joinedAt} DESC`)
    .limit(1);

  if (!hit) {
    // 204 = "no content" — semantically right for "you're not in any room
    // and that's fine". Browsers don't try to parse the body.
    return new NextResponse(null, { status: 204 });
  }

  const snapshot = await getRoomSnapshot(hit.id);
  if (!snapshot) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(snapshot);
}


// ---- POST: create a new room. Host gets seat 0. ------------------------
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const { id: gameid } = await params;
  if (!gameid) {
    return NextResponse.json({ error: "missing game id" }, { status: 400 });
  }
  const gameIdNum = parseInt(gameid, 10);
  if (Number.isNaN(gameIdNum)) {
    return NextResponse.json({ error: "invalid game id" }, { status: 400 });
  }

  const { isChecked, maxPlayers } = await req.json().catch(() => ({}));
  if (isChecked === undefined) {
    return NextResponse.json(
      { error: "isChecked required in body" },
      { status: 400 },
    );
  }

  const roomID = hashStrings(gameid, userId);
  const cap = typeof maxPlayers === "number" && maxPlayers >= 2 ? maxPlayers : 2;

  await db
    .insert(gameSessions)
    .values([
      {
        id: roomID.toString(),
        gameId: gameIdNum,
        public: isChecked,
        isFull: false,
        maxPlayers: cap,
        createdBy: userId,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(gameParticipants)
    .values([
      {
        gameSessionId: roomID.toString(),
        userId,
        seat: 0,
      },
    ])
    .onConflictDoNothing();

  const snapshot = await getRoomSnapshot(roomID.toString());
  if (!snapshot) {
    return NextResponse.json({ error: "room creation failed" }, { status: 500 });
  }
  return NextResponse.json(snapshot);
}


// ---- PUT: join an existing room. -------------------------------------
// If no roomID in the body, finds a random public room with open seats.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const { id: gameid } = await params;
  const gameIdNum = parseInt(gameid, 10);
  if (Number.isNaN(gameIdNum)) {
    return NextResponse.json({ error: "invalid game id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  let roomID: string | undefined = body?.roomID || undefined;

  if (!roomID) {
    const found = await db
      .select({ id: gameSessions.id })
      .from(gameSessions)
      .where(
        and(
          eq(gameSessions.public, true),
          eq(gameSessions.gameId, gameIdNum),
          eq(gameSessions.isFull, false),
        ),
      )
      .limit(1);
    if (found.length === 0) {
      return NextResponse.json(
        { error: "no public rooms available — create one or get a room ID from a friend" },
        { status: 404 },
      );
    }
    roomID = found[0].id;
  }

  const [room] = await db
    .select({
      id: gameSessions.id,
      maxPlayers: gameSessions.maxPlayers,
      isFull: gameSessions.isFull,
    })
    .from(gameSessions)
    .where(eq(gameSessions.id, roomID))
    .limit(1);

  if (!room) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }

  // Membership check FIRST — a returning participant should always get
  // back into the room they're already in, even if it's now full. The
  // isFull guard below only blocks NEW joiners.
  const [existing] = await db
    .select({ userId: gameParticipants.userId })
    .from(gameParticipants)
    .where(
      and(
        eq(gameParticipants.gameSessionId, roomID),
        eq(gameParticipants.userId, userId),
      ),
    )
    .limit(1);

  if (!existing && room.isFull) {
    return NextResponse.json({ error: "room is full" }, { status: 409 });
  }

  if (!existing) {
    // Count current participants to compute the next seat number. Racy
    // under concurrent joins (two joiners could grab the same seat) but
    // not corrupting — PK is on (session, user), seat is decorative.
    const [{ count: currentCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gameParticipants)
      .where(eq(gameParticipants.gameSessionId, roomID));

    await db
      .insert(gameParticipants)
      .values([
        {
          gameSessionId: roomID,
          userId,
          seat: currentCount,
        },
      ])
      .onConflictDoNothing();

    const [{ count: newCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gameParticipants)
      .where(eq(gameParticipants.gameSessionId, roomID));

    if (newCount >= room.maxPlayers) {
      await db
        .update(gameSessions)
        .set({ isFull: true })
        .where(eq(gameSessions.id, roomID));
    }
  }

  const snapshot = await getRoomSnapshot(roomID);
  if (!snapshot) {
    return NextResponse.json({ error: "room vanished" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}


// ---- DELETE: leave a room. -------------------------------------------
// Removes the caller's participant row. If no participants remain, drops
// the whole room (cascade nukes any moves). If participants remain, flips
// is_full back to false so the seat opens up for new joiners.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const { id: gameid } = await params;
  const gameIdNum = parseInt(gameid, 10);
  if (Number.isNaN(gameIdNum)) {
    return NextResponse.json({ error: "invalid game id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const roomID: string | undefined = body?.roomID;
  if (!roomID) {
    return NextResponse.json({ error: "roomID required in body" }, { status: 400 });
  }

  // Confirm the user is actually in this room before doing anything.
  const [participantRow] = await db
    .select({ userId: gameParticipants.userId })
    .from(gameParticipants)
    .where(
      and(
        eq(gameParticipants.gameSessionId, roomID),
        eq(gameParticipants.userId, userId),
      ),
    )
    .limit(1);

  if (!participantRow) {
    return NextResponse.json(
      { error: "you're not in this room" },
      { status: 404 },
    );
  }

  await db
    .delete(gameParticipants)
    .where(
      and(
        eq(gameParticipants.gameSessionId, roomID),
        eq(gameParticipants.userId, userId),
      ),
    );

  const [{ count: remaining }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gameParticipants)
    .where(eq(gameParticipants.gameSessionId, roomID));

  if (remaining === 0) {
    // Last one out — drop the room. Cascade handles game_moves.
    await db.delete(gameSessions).where(eq(gameSessions.id, roomID));
    return NextResponse.json({ ok: true, roomDeleted: true });
  }

  // Someone left → seat opened up, undo the isFull flag.
  await db
    .update(gameSessions)
    .set({ isFull: false })
    .where(eq(gameSessions.id, roomID));

  const snapshot = await getRoomSnapshot(roomID);
  return NextResponse.json({ ok: true, roomDeleted: false, ...snapshot });
}
