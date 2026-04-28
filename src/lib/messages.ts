// -----------------------------------------------------------------------------
// Messaging — Postgres-backed implementation.
//
// Public API matches the previous in-memory version exactly so the API routes
// in /app/api/messages/* keep working unchanged. Functions are async now.
//
// Schema lives in src/db/schema.ts. The DDL there mirrors what was in this
// file's old header comment one-to-one.
//
// Transactions: the @neondatabase/serverless HTTP driver does NOT support
// interactive transactions, so sendMessage runs three separate statements
// (INSERT message, UPDATE conversation denorm, UPDATE participant unread
// counts). If a later statement fails, the next sendMessage will overwrite
// the stale denorm, and markRead will reset stale unread counts — so the
// inconsistency is bounded and self-healing. To get real ACID guarantees,
// switch src/db/index.ts to the WebSocket Pool driver and wrap the three
// statements in `db.transaction(async (tx) => …)`.
// -----------------------------------------------------------------------------

import { and, asc, desc, eq, isNotNull, lt, ne, sql } from "drizzle-orm";
import {
  db,
  conversations,
  conversationParticipants,
  messages as messagesTable,
  messageReactions,
} from "@/db";
import { makeId } from "@/lib/ids";

// Re-export the shapes app code already imports as types.
export type ConversationType = "dm" | "group";

export interface Conversation {
  id: string;
  type: ConversationType;
  // Snapshot name. Set at creation for groups; null for DMs (the UI derives
  // a DM label from the other participant). Stays stable when members leave
  // — that's the whole point of persisting it instead of recomputing.
  name: string | null;
  participants: string[];
  createdAt: number;
  lastMessageAt: number | null;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  // null when the sender's account has been deleted (FK ON DELETE SET NULL).
  senderId: string | null;
  content: string;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
}

export interface ParticipantState {
  conversationId: string;
  userId: string;
  lastReadAt: number;
  unreadCount: number;
  muted: boolean;
}

// -----------------------------------------------------------------------------
// Internal: shape converters from DB rows (Date objects, nullable columns)
// to the existing API shape (epoch ms, plain numbers).
// -----------------------------------------------------------------------------

type ConversationRow = typeof conversations.$inferSelect;
type MessageRow = typeof messagesTable.$inferSelect;
type ParticipantRow = typeof conversationParticipants.$inferSelect;

function toMs(d: Date | null): number | null {
  return d ? d.getTime() : null;
}

async function loadParticipants(conversationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));
  return rows.map((r) => r.userId).sort();
}

async function hydrateConversation(row: ConversationRow): Promise<Conversation> {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    participants: await loadParticipants(row.id),
    createdAt: row.createdAt.getTime(),
    lastMessageAt: toMs(row.lastMessageAt),
    lastMessagePreview: row.lastMessagePreview,
    lastMessageSenderId: row.lastMessageSenderId,
  };
}

function hydrateMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    content: row.content,
    createdAt: row.createdAt.getTime(),
    editedAt: toMs(row.editedAt),
    deletedAt: toMs(row.deletedAt),
  };
}

function hydrateParticipant(row: ParticipantRow): ParticipantState {
  return {
    conversationId: row.conversationId,
    userId: row.userId,
    lastReadAt: toMs(row.lastReadAt) ?? 0,
    unreadCount: row.unreadCount,
    muted: row.muted,
  };
}

// DM ids are deterministic from the sorted user pair so getOrCreateDm can
// idempotently look up an existing DM without scanning. Underscores only
// (no colons) so they survive Next.js dynamic route matching unencoded.
function dmId(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `dm_${x}_${y}`;
}

// -----------------------------------------------------------------------------
// Conversations
// -----------------------------------------------------------------------------

export async function getOrCreateDm(userA: string, userB: string): Promise<Conversation> {
  const id = dmId(userA, userB);

  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  if (existing) return hydrateConversation(existing);

  // Create the conversation + both participant rows. Three statements
  // because no interactive transactions on the HTTP driver — see file
  // header for the consistency note.
  const [conv] = await db
    .insert(conversations)
    .values({
      id,
      type: "dm",
      createdBy: userA,
    })
    .returning();

  await db.insert(conversationParticipants).values([
    { conversationId: id, userId: userA },
    { conversationId: id, userId: userB },
  ]);

  return hydrateConversation(conv);
}

export async function createGroup(
  creatorId: string,
  memberIds: string[],
  opts: { name?: string } = {},
): Promise<Conversation> {
  const participants = Array.from(new Set([creatorId, ...memberIds]));
  const id = `grp_${creatorId}_${Date.now()}_${makeId(6)}`;

  const [conv] = await db
    .insert(conversations)
    .values({
      id,
      type: "group",
      name: opts.name ?? null,
      createdBy: creatorId,
    })
    .returning();

  await db.insert(conversationParticipants).values(
    participants.map((userId) => ({ conversationId: id, userId })),
  );

  return hydrateConversation(conv);
}

export async function getConversation(
  conversationId: string,
): Promise<Conversation | null> {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row ? hydrateConversation(row) : null;
}

// Remove `userId` from the conversation. Symmetric across DMs and groups:
//   - The caller's participant row goes.
//   - DMs: if the *other* side is also gone after that, nuke the conversation.
//     The lone-survivor case (other person is still in the DM) just leaves
//     them with an "Empty channel" entry until they leave too.
//   - Groups: the group survives. If the leaver was the creator, ownership
//     hands off to whoever joined earliest among the rest. If everyone is
//     gone we drop the conversation.
//
// Returns whether the conversation was deleted (so the route can tell the
// client to fully drop it from the inbox vs. just refresh).
export async function leaveConversation(
  conversationId: string,
  userId: string,
): Promise<{ deleted: boolean }> {
  // Look up the conversation up-front so we can branch on type and creator
  // without a second round trip.
  const [conv] = await db
    .select({
      id: conversations.id,
      type: conversations.type,
      createdBy: conversations.createdBy,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) {
    return { deleted: false };
  }

  // Membership check — caller has to actually be in the convo to leave it.
  const wasIn = await isParticipant(conversationId, userId);
  if (!wasIn) {
    throw new Error("not a participant");
  }

  await db
    .delete(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    );

  // Anyone left?
  const [survivor] = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId))
    .orderBy(asc(conversationParticipants.joinedAt))
    .limit(1);

  // Empty (group with no one left, or DM where the other side already left)
  // — drop the conversation. FK cascades wipe messages + reactions.
  if (!survivor) {
    await db.delete(conversations).where(eq(conversations.id, conversationId));
    return { deleted: true };
  }

  // Creator handoff for groups (and DMs too, defensively — cheap when no-op).
  if (conv.createdBy === userId) {
    await db
      .update(conversations)
      .set({ createdBy: survivor.userId })
      .where(eq(conversations.id, conversationId));
  }

  return { deleted: false };
}

export async function isParticipant(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return !!row;
}

export interface InboxEntry {
  conversation: Conversation;
  state: ParticipantState;
}

export async function listConversationsForUser(
  userId: string,
): Promise<InboxEntry[]> {
  // One join: pull the participant row (for unread/muted) alongside the
  // conversation row.
  //
  // Filter on `lastMessageAt IS NOT NULL` so empty conversations don't clutter
  // the inbox — they exist in the DB (so `getOrCreateDm` stays idempotent) but
  // only surface once someone actually sends the first message.
  const rows = await db
    .select({
      conv: conversations,
      part: conversationParticipants,
    })
    .from(conversationParticipants)
    .innerJoin(
      conversations,
      eq(conversations.id, conversationParticipants.conversationId),
    )
    .where(
      and(
        eq(conversationParticipants.userId, userId),
        isNotNull(conversations.lastMessageAt),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt));

  // hydrateConversation does N participant lookups — fine at this scale,
  // but if inbox grows large, batch via one IN-query instead.
  const out: InboxEntry[] = [];
  for (const row of rows) {
    out.push({
      conversation: await hydrateConversation(row.conv),
      state: hydrateParticipant(row.part),
    });
  }
  return out;
}

// -----------------------------------------------------------------------------
// Messages
// -----------------------------------------------------------------------------

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
}

export async function sendMessage({
  conversationId,
  senderId,
  content,
}: SendMessageInput): Promise<Message> {
  // Authorize before writing — caller already checks isParticipant in routes,
  // but the FK on messages.conversation_id will fail anyway if the conv is
  // missing, and this gives a clearer error for the participant case.
  const inConv = await isParticipant(conversationId, senderId);
  if (!inConv) throw new Error("not a participant");

  const id = `msg_${Date.now()}_${makeId(8)}`;
  const [msgRow] = await db
    .insert(messagesTable)
    .values({ id, conversationId, senderId, content })
    .returning();

  // Denormalize onto the conversation. Truncate the preview at 140 chars to
  // bound the index/payload size.
  await db
    .update(conversations)
    .set({
      lastMessageAt: msgRow.createdAt,
      lastMessagePreview: content.slice(0, 140),
      lastMessageSenderId: senderId,
    })
    .where(eq(conversations.id, conversationId));

  // Bump unread for every other participant; mark sender's row read.
  // `unread_count = unread_count + 1` is a single row update — no read needed.
  await db
    .update(conversationParticipants)
    .set({ unreadCount: sql`${conversationParticipants.unreadCount} + 1` })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        ne(conversationParticipants.userId, senderId),
      ),
    );
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: msgRow.createdAt, unreadCount: 0 })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, senderId),
      ),
    );

  return hydrateMessage(msgRow);
}

export interface PageOptions {
  limit?: number;
  before?: number; // exclusive cursor on createdAt (epoch ms)
}

export interface MessagePage {
  messages: Message[]; // ascending by createdAt
  nextBefore: number | null;
}

export async function getMessages(
  conversationId: string,
  opts: PageOptions = {},
): Promise<MessagePage> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const beforeMs = opts.before ?? null;

  // Keyset pagination — uses messages_conv_created_idx
  // (conversation_id, created_at DESC, id) defined in schema.ts.
  // Pull `limit` rows DESC, then reverse for ASC display.
  const where = beforeMs
    ? and(
        eq(messagesTable.conversationId, conversationId),
        lt(messagesTable.createdAt, new Date(beforeMs)),
      )
    : eq(messagesTable.conversationId, conversationId);

  const rows = await db
    .select()
    .from(messagesTable)
    .where(where)
    .orderBy(desc(messagesTable.createdAt), desc(messagesTable.id))
    .limit(limit);

  const ascending = rows.slice().reverse().map(hydrateMessage);
  const nextBefore =
    ascending.length === limit ? ascending[0].createdAt : null;
  return { messages: ascending, nextBefore };
}

// -----------------------------------------------------------------------------
// Read state
// -----------------------------------------------------------------------------

export async function markRead(
  conversationId: string,
  userId: string,
  at: number = Date.now(),
): Promise<void> {
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date(at), unreadCount: 0 })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    );
}

// -----------------------------------------------------------------------------
// Reactions + edits
// -----------------------------------------------------------------------------

export interface Reaction {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: number;
}

export async function addReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<Reaction> {
  const [row] = await db
    .insert(messageReactions)
    .values({ messageId, userId, emoji })
    .onConflictDoNothing() // PK = (message_id, user_id, emoji) — already-present is a no-op
    .returning();

  // returning() yields nothing on conflict — fall back to a select.
  if (row) {
    return {
      messageId: row.messageId,
      userId: row.userId,
      emoji: row.emoji,
      createdAt: row.createdAt.getTime(),
    };
  }
  const [existing] = await db
    .select()
    .from(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji),
      ),
    )
    .limit(1);
  return {
    messageId: existing.messageId,
    userId: existing.userId,
    emoji: existing.emoji,
    createdAt: existing.createdAt.getTime(),
  };
}

export async function getReactions(messageId: string): Promise<Reaction[]> {
  const rows = await db
    .select()
    .from(messageReactions)
    .where(eq(messageReactions.messageId, messageId));
  return rows.map((r) => ({
    messageId: r.messageId,
    userId: r.userId,
    emoji: r.emoji,
    createdAt: r.createdAt.getTime(),
  }));
}

export async function editMessage(
  messageId: string,
  userId: string,
  content: string,
): Promise<Message | null> {
  const [existing] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.id, messageId))
    .limit(1);
  if (!existing) return null;
  if (existing.senderId !== userId) throw new Error("not the author");

  const [updated] = await db
    .update(messagesTable)
    .set({ content, editedAt: new Date() })
    .where(eq(messagesTable.id, messageId))
    .returning();
  return updated ? hydrateMessage(updated) : null;
}
