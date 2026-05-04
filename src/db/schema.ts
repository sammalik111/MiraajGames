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
  jsonb,
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
// Game data — leaderboards + anti-cheat run tokens.
// -----------------------------------------------------------------------------

// Every submitted score, ever. The audit log.
export const gameScores = pgTable(
  "game_scores",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: integer("game_id").notNull(),
    score: integer("score").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    // Imagine you have score X on Tetris. Months later I fix a bug that made line clears award too many points, or add a new piece, 
    // or you slow the speed curve. New scores under the new rules can't compete with old scores. so leaderboards are per-game-version.
    gameVersion: integer("game_version").notNull().default(1),
    seasonId: text("season_id"),
    // Hides the score from public boards if flagged as suspicious.
    isFlagged: boolean("is_flagged").notNull().default(false),
    // Links to the run token issued at game start (see gameRuns).
    runId: text("run_id"),
    achievedAt: timestamp("achieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // An index is a SORTED, separate copy of one or more columns from a table.
    // Each entry in the index has a pointer back to the full row it came from.
    // You're storing an extra N-size structure (more memory) BUT lookups get
    // way faster — things like "last X scores of this game" go from scanning
    // the whole table to jumping straight to that game's section.

    // USEFUL FOR QUICKLY:
    // 1. Finding out what games had the most activity in X time
    // 2. Seeing if there are too many submission to be real attempts in X time by any users
    index("game_scores_game_recent_idx").on(
      t.gameId,
      sql`${t.achievedAt} DESC`,
    ),
  ],
);

// One row per (game, user) holding only their best score. This is what the
// leaderboard reads from — separate table because reads vastly outnumber writes.
export const bestScoresForGame = pgTable(
  "best_scores_for_game",
  {
    gameId: integer("game_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    gameVersion: integer("game_version").notNull().default(1),
    seasonId: text("season_id"),
    achievedAt: timestamp("achieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.userId] }),
    // seperate mini table of [gameID, score, timestamp, rowNumInGameScores], sorted by 
    // highest score for each game first, tiebreakers broken by whoever got that score first

    // gameId score   achievedAt	→ row pointer
    // 8	    3200	  Jan 8	      → row 6
    // 9	    9000	  Jan 6	      → row 3
    // 9	    4500	  Jan 3	      → row 1
    // 9	    4500	  Jan 7	      → row 5
    // 14	    25	    Jan 9	      → row 7
    // 14	    12	    Jan 4	      → row 2
    // 14	    8	      Jan 5	      → row 4
    index("best_scores_leaderboard_idx").on(
      t.gameId,
      sql`${t.score} DESC`,
      t.achievedAt,
    ),
    index("best_scores_user_idx").on(t.userId),
  ],
);

// Anti-cheat: server hands out a token at game start; client must return it
// when submitting a score. Stops people from posting fake scores via curl.
export const gameRuns = pgTable(
  "game_runs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: integer("game_id").notNull(),
    gameVersion: integer("game_version").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Set once the token is redeemed — prevents reusing the same token twice.
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [index("game_runs_user_game_idx").on(t.userId, t.gameId)],
);


// Metadata for an actual multiplayer game room.
// Table name is snake_case to match every other table in this file. Column
// `game_id` is `integer` to match game_scores / best_scores_for_game / game_runs
// — game ids come from gameData.js as numbers (1..16), not strings.
export const gameSessions = pgTable("game_sessions", {
  id: text("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  public: boolean("public").notNull().default(false),
  isFull: boolean("is_full").notNull().default(false),
  // How many participants the session is built for. Default 2 keeps the
  // existing 1v1 behavior; set higher per game (4 for a co-op, etc.) to
  // unlock N-player rooms. The PUT/join handler uses this to decide when
  // to flip is_full.
  maxPlayers: integer("max_players").notNull().default(2),
  // Nullable + set-null on user delete — the room outlives the creator.
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Append-only event log of moves in a multiplayer session. Server stays
// game-agnostic: it stores ordered moves with opaque jsonb payloads. Each
// game's client interprets its own payload shape (TicTacToe: { cell },
// Battleship: { type, x, y }, Pool: { angleDeg, power }, etc.).
//
// move_number is the canonical ordering. Composite (session, move_number)
// is unique so two players can't claim the same slot, and it's the index
// the GET endpoint uses to fetch "moves since N".
export const gameMoves = pgTable(
  "game_moves",
  {
    id: text("id").primaryKey(),
    gameSessionId: text("game_session_id")
      .notNull()
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    // Nullable + set-null on user delete — past moves survive the
    // sender's account deletion as anonymized history.
    senderId: text("sender_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // 0-indexed sequence number. First move = 0.
    moveNumber: integer("move_number").notNull(),
    // Game-specific move shape. Kept opaque server-side.
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Replay queries (`WHERE session_id = ? AND move_number > N ORDER BY move_number`)
    // hit this index instead of scanning the table.
    index("game_moves_session_seq_idx").on(t.gameSessionId, t.moveNumber),
  ],
);

// Participants in a multiplayer session.
// One row per (session, user) — same shape as conversation_participants —
// so a session can hold any number of players up to gameSessions.maxPlayers.
// Composite PK enforces "user is in this session at most once".
export const gameParticipants = pgTable(
  "game_participants",
  {
    gameSessionId: text("game_session_id")
      .notNull()
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Optional turn-order slot — first joiner = 0, second = 1, etc. Lets
    // games that care about seat order (Chess, TicTacToe) read it directly
    // instead of inferring from joinedAt.
    seat: integer("seat").notNull().default(0),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.gameSessionId, t.userId] }),
    // For "show me all sessions I'm in" — single-column index on user_id.
    index("game_participants_user_idx").on(t.userId),
  ],
);



// -----------------------------------------------------------------------------
// Inferred TS types
// -----------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type GameScore = typeof gameScores.$inferSelect;
export type NewGameScore = typeof gameScores.$inferInsert;
export type BestScoreForGame = typeof bestScoresForGame.$inferSelect;
export type NewBestScoreForGame = typeof bestScoresForGame.$inferInsert;
export type GameRun = typeof gameRuns.$inferSelect;
export type NewGameRun = typeof gameRuns.$inferInsert;
export type GameSession = typeof gameSessions.$inferSelect;
export type NewGameSession = typeof gameSessions.$inferInsert;
export type GameMove = typeof gameMoves.$inferSelect;
export type NewGameMove = typeof gameMoves.$inferInsert;

// Shared move-payload types. Server doesn't care about these — only client
// game components interpret them. Add new entries as you bring more games
// online (chess, etc.).
export type TicTacToeMove = { cell: number }; // 0..8
export type BattleshipMove =
  | { type: "place"; ship: string; x: number; y: number; orientation: "h" | "v" }
  | { type: "fire"; x: number; y: number };
export type PoolMove = { angleDeg: number; power: number };
export type GameParticipant = typeof gameParticipants.$inferSelect;
export type NewGameParticipant = typeof gameParticipants.$inferInsert;