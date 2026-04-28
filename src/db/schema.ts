// -----------------------------------------------------------------------------
// Database schema — single source of truth.
//
// Drizzle reads this file to:
//   1. Generate SQL migration files (drizzle-kit generate)
//   2. Provide typed query builders to app code (`db.select().from(users)…`)
//
// Conventions:
// - Primary keys are short text ids (nanoid-style), not autoincrement integers.
//   Reason: autoincrement leaks business info and breaks under sharding.
// - Timestamps are `timestamptz` so timezone math is free.
// - Foreign keys cascade on delete where it makes semantic sense (e.g.
//   deleting a conversation deletes its messages and participants).
// -----------------------------------------------------------------------------

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// -----------------------------------------------------------------------------
// Users + auth
// -----------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // nanoid generated in app code
    email: text("email").notNull().unique(),
    name: text("name"),
    // Optional public-facing handle, distinct from `name`. Falls back to
    // name → email in the UI when null.
    nickname: text("nickname"),
    // URL to a profile picture (S3, gravatar, whatever). Null = use the
    // monogram avatar fallback.
    avatarUrl: text("avatar_url"),
    // bcrypt hash — never the plain password.
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

// Many-to-many: a user has many favorite games (game ids are integers from gameData.js).
// Was: userFavorites: Record<userId, gameId[]>
export const userFavorites = pgTable(
  "user_favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: integer("game_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

// Symmetric friendship: A friends B implies B friends A. We store both rows
// to make "list my friends" a single-direction query — addFriend writes both,
// removeFriend deletes both. Simpler than enforcing directional pairs.
export const userFriends = pgTable(
  "user_friends",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: text("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.friendId] }),
    index("user_friends_user_idx").on(t.userId),
  ],
);

// -----------------------------------------------------------------------------
// Messaging — mirrors the SQL DDL comment from the old in-memory store.
// -----------------------------------------------------------------------------

export const conversationTypeEnum = pgEnum("conversation_type", ["dm", "group"]);

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  type: conversationTypeEnum("type").notNull(),
  // Optional group name — null for DMs.
  name: text("name"),
  // Nullable + set-null on user delete — the conversation outlives the
  // creator. UIs that care can show "Unknown" or just hide the field.
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Denormalized for O(1) inbox rendering — updated by sendMessage().
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  lastMessagePreview: text("last_message_preview"),
  lastMessageSenderId: text("last_message_sender_id").references(
    () => users.id,
    { onDelete: "set null" },
  ),
});

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // Nullable + set-null on user delete — past messages survive the
    // sender's account deletion as anonymized history. UI renders these
    // as "Unknown User".
    senderId: text("sender_id").references(() => users.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    // Soft delete — keep the row so reactions/replies don't dangle.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // The keyset-pagination index. Matches the SQL in messages.ts:
    //   WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?
    // The id tiebreaker gives a stable order when two messages share a timestamp.
    index("messages_conv_created_idx").on(
      t.conversationId,
      sql`${t.createdAt} DESC`,
      t.id,
    ),
  ],
);

// One row per (conversation, user) — composite PK enforces "user is in this conv at most once".
export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    unreadCount: integer("unread_count").notNull().default(0),
    muted: boolean("muted").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    // For "show me all my conversations" — single-column index on user_id.
    index("conv_participants_user_idx").on(t.userId),
  ],
);

// Extensibility: emoji reactions on messages. PK prevents the same user
// stacking the same emoji twice on the same message.
export const messageReactions = pgTable(
  "message_reactions",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })],
);

// -----------------------------------------------------------------------------
// Relations — let Drizzle do typed joins (`db.query.conversations.findMany({
//   with: { messages: true, participants: { with: { user: true } } } })`).
// -----------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  favorites: many(userFavorites),
  friendships: many(userFriends, { relationName: "friendships" }),
  participantOf: many(conversationParticipants),
  sentMessages: many(messages),
}));

export const conversationsRelations = relations(conversations, ({ many, one }) => ({
  messages: many(messages),
  participants: many(conversationParticipants),
  creator: one(users, {
    fields: [conversations.createdBy],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  reactions: many(messageReactions),
}));

export const conversationParticipantsRelations = relations(
  conversationParticipants,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationParticipants.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationParticipants.userId],
      references: [users.id],
    }),
  }),
);

// -----------------------------------------------------------------------------
// Inferred TS types — import these in app code instead of redefining shapes.
// -----------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
