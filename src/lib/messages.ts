// -----------------------------------------------------------------------------
// Scalable conversation-centric messaging store (in-memory demo).
//
// Shape maps 1:1 to a SQL schema:
//   conversations(id PK, type, created_at, last_message_at,
//                 last_message_preview, last_message_sender_id)
//   messages(id PK, conversation_id FK, sender_id, content,
//            created_at, edited_at, deleted_at)
//     INDEX (conversation_id, created_at DESC, id)
//   conversation_participants(conversation_id, user_id, last_read_at,
//                             unread_count, muted, PK(conversation_id, user_id))
//     INDEX (user_id)  -- for "my inbox"
//   message_reactions(message_id, user_id, emoji, PK(...))  -- extensibility
//
// Messages are append-only and stored ONCE per conversation (never per user).
// Denormalized fields on the conversation (last_message_*) and on the
// participant row (unread_count) make inbox + unread badges O(1) to render.
// -----------------------------------------------------------------------------

export type ConversationType = "dm" | "group";

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: string[]; // user ids
  createdAt: number;
  lastMessageAt: number | null;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
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

// In-memory tables (demo). Swap for Postgres/Mongo without changing callers.
const conversations = new Map<string, Conversation>();
const messagesByConversation = new Map<string, Message[]>(); // kept sorted by createdAt
const participantsByKey = new Map<string, ParticipantState>(); // key: `${convId}:${userId}`
const conversationsByUser = new Map<string, Set<string>>(); // userId -> conversationIds

function participantKey(conversationId: string, userId: string) {
  return `${conversationId}:${userId}`;
}

function dmId(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `dm_${x}_${y}`;
}

function addUserIndex(userId: string, conversationId: string) {
  let set = conversationsByUser.get(userId);
  if (!set) {
    set = new Set();
    conversationsByUser.set(userId, set);
  }
  set.add(conversationId);
}

function ensureParticipant(conversationId: string, userId: string) {
  const key = participantKey(conversationId, userId);
  let p = participantsByKey.get(key);
  if (!p) {
    p = {
      conversationId,
      userId,
      lastReadAt: 0,
      unreadCount: 0,
      muted: false,
    };
    participantsByKey.set(key, p);
  }
  return p;
}

// -----------------------------------------------------------------------------
// Conversations
// -----------------------------------------------------------------------------

export function getOrCreateDm(userA: string, userB: string): Conversation {
  const id = dmId(userA, userB);
  let conv = conversations.get(id);
  if (conv) return conv;
  conv = {
    id,
    type: "dm",
    participants: [userA, userB].sort(),
    createdAt: Date.now(),
    lastMessageAt: null,
    lastMessagePreview: null,
    lastMessageSenderId: null,
  };
  conversations.set(id, conv);
  ensureParticipant(id, userA);
  ensureParticipant(id, userB);
  addUserIndex(userA, id);
  addUserIndex(userB, id);
  messagesByConversation.set(id, []);
  return conv;
}

export function createGroup(creatorId: string, memberIds: string[]): Conversation {
  const participants = Array.from(new Set([creatorId, ...memberIds]));
  const id = `grp_${creatorId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const conv: Conversation = {
    id,
    type: "group",
    participants,
    createdAt: Date.now(),
    lastMessageAt: null,
    lastMessagePreview: null,
    lastMessageSenderId: null,
  };
  conversations.set(id, conv);
  messagesByConversation.set(id, []);
  for (const uid of participants) {
    ensureParticipant(id, uid);
    addUserIndex(uid, id);
  }
  return conv;
}

export function getConversation(conversationId: string): Conversation | null {
  return conversations.get(conversationId) ?? null;
}

export function isParticipant(conversationId: string, userId: string): boolean {
  const conv = conversations.get(conversationId);
  return !!conv && conv.participants.includes(userId);
}

export interface InboxEntry {
  conversation: Conversation;
  state: ParticipantState;
}

export function listConversationsForUser(userId: string): InboxEntry[] {
  const ids = conversationsByUser.get(userId);
  if (!ids) return [];
  const out: InboxEntry[] = [];
  for (const id of ids) {
    const conv = conversations.get(id);
    const state = participantsByKey.get(participantKey(id, userId));
    if (conv && state) out.push({ conversation: conv, state });
  }
  // Sort by lastMessageAt desc (fallback to createdAt for empty conversations)
  out.sort(
    (a, b) =>
      (b.conversation.lastMessageAt ?? b.conversation.createdAt) -
      (a.conversation.lastMessageAt ?? a.conversation.createdAt)
  );
  return out;
}

// -----------------------------------------------------------------------------
// Messages — append-only, one row per message
// -----------------------------------------------------------------------------

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
}

export function sendMessage({ conversationId, senderId, content }: SendMessageInput): Message {
  const conv = conversations.get(conversationId);
  if (!conv) throw new Error("conversation not found");
  if (!conv.participants.includes(senderId)) throw new Error("not a participant");

  const msg: Message = {
    id: `msg:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
    conversationId,
    senderId,
    content,
    createdAt: Date.now(),
    editedAt: null,
    deletedAt: null,
  };
  const list = messagesByConversation.get(conversationId)!;
  list.push(msg); // append — already ordered by createdAt

  // Denormalize onto conversation for O(1) inbox preview.
  conv.lastMessageAt = msg.createdAt;
  conv.lastMessagePreview = content.slice(0, 140);
  conv.lastMessageSenderId = senderId;

  // Bump unread for every other participant; sender is implicitly "read".
  for (const uid of conv.participants) {
    const p = ensureParticipant(conversationId, uid);
    if (uid === senderId) {
      p.lastReadAt = msg.createdAt;
      p.unreadCount = 0;
    } else {
      p.unreadCount += 1;
    }
  }
  return msg;
}

export interface PageOptions {
  limit?: number;
  before?: number; // cursor: createdAt timestamp (exclusive)
}

export interface MessagePage {
  messages: Message[]; // ascending by createdAt (oldest first of the page)
  nextBefore: number | null; // pass back to load older
}

export function getMessages(conversationId: string, opts: PageOptions = {}): MessagePage {
  const list = messagesByConversation.get(conversationId) ?? [];
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const before = opts.before ?? Number.POSITIVE_INFINITY;

  // Keyset pagination: take the last `limit` messages strictly older than `before`.
  // In SQL: WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?
  const filtered: Message[] = [];
  for (let i = list.length - 1; i >= 0 && filtered.length < limit; i--) {
    if (list[i].createdAt < before) filtered.push(list[i]);
  }
  filtered.reverse(); // return ascending for easy rendering

  const nextBefore = filtered.length === limit ? filtered[0].createdAt : null;
  return { messages: filtered, nextBefore };
}

// -----------------------------------------------------------------------------
// Read state
// -----------------------------------------------------------------------------

export function markRead(conversationId: string, userId: string, at: number = Date.now()) {
  const p = participantsByKey.get(participantKey(conversationId, userId));
  if (!p) return;
  p.lastReadAt = at;
  p.unreadCount = 0;
}

// -----------------------------------------------------------------------------
// Extensibility stubs — same shape as a separate reactions table
// -----------------------------------------------------------------------------

export interface Reaction {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: number;
}

const reactionsByMessage = new Map<string, Reaction[]>();

export function addReaction(messageId: string, userId: string, emoji: string): Reaction {
  const r: Reaction = { messageId, userId, emoji, createdAt: Date.now() };
  const list = reactionsByMessage.get(messageId) ?? [];
  list.push(r);
  reactionsByMessage.set(messageId, list);
  return r;
}

export function getReactions(messageId: string): Reaction[] {
  return reactionsByMessage.get(messageId) ?? [];
}

export function editMessage(messageId: string, userId: string, content: string): Message | null {
  // O(n) here for demo; in SQL this is a PK update.
  for (const list of messagesByConversation.values()) {
    const m = list.find((x) => x.id === messageId);
    if (m) {
      if (m.senderId !== userId) throw new Error("not the author");
      m.content = content;
      m.editedAt = Date.now();
      return m;
    }
  }
  return null;
}