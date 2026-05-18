"use client";

import Navbar from "@/components/navbar";
import HudPanel from "@/components/HudPanel";
import ChooseFriends from "@/components/chooseFriends";
import { useAuth } from "@/lib/useAuth";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Friend {
  id: string;
  name: string;
  image?: string;
}

// Shape returned by GET /api/messages/conversations.
interface InboxEntry {
  id: string; // conversation id — used for the link target
  type: "dm" | "group";
  // Stored snapshot name (groups). Stable when members leave; UI prefers
  // this over the derived join-of-other-users.
  name: string | null;
  participants: string[];
  otherUsers: { id: string; name: string; image?: string | null }[];
  lastMessageAt: number | null;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
  muted: boolean;
}

// Matches profile/page avatar styling — neon monogram or image in hud-clip.
function Avatar({ name, image, size = 48 }: { name: string; image?: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const accents = ["var(--neon-cyan)", "var(--neon-magenta)", "var(--neon-yellow)", "var(--neon-lime)"];
  const accent = accents[name.charCodeAt(0) % accents.length];

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="object-cover flex-shrink-0 hud-clip"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="hud-clip flex items-center justify-center flex-shrink-0 font-display font-black text-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: accent,
        boxShadow: `0 0 10px -3px ${accent}`,
      }}
    >
      {initials}
    </div>
  );
}

// Display label. Groups prefer the persisted `name` snapshot so the inbox
// doesn't shift when a member leaves; falls back to derived. DMs always
// derive from the other participant (or "Empty channel" if they've left).
function entryLabel(entry: InboxEntry): string {
  if (entry.type === "group") {
    if (entry.name) return entry.name;
    if (entry.otherUsers.length === 0) return "Empty channel";
    return entry.otherUsers.map((u) => u.name).join(", ");
  }
  if (entry.otherUsers.length === 0) return "Empty channel";
  return entry.otherUsers[0].name;
}

function entryAvatarName(entry: InboxEntry): string {
  return entry.otherUsers[0]?.name ?? "?";
}

// For DMs, show the other user's avatar. For groups, fall back to the first
// other user's avatar — the API doesn't store a group image, so this is the
// closest we can do without schema changes.
function entryAvatarImage(entry: InboxEntry): string | undefined {
  return entry.otherUsers[0]?.image ?? undefined;
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

export default function MessagesPage() {
  const { userId, authed, loading } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const [friendIdInput, setFriendIdInput] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [addError, setAddError] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showChooseFriends, setShowChooseFriends] = useState(false);
  // Inbox search filter. Pure client-side — the inbox list is small
  // and already loaded, so filtering in JS is instant. Searches title +
  // last message preview.
  const [inboxQuery, setInboxQuery] = useState("");

  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/friends/getFriends?userID=${userId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFriends(data.friends ?? []);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      console.error("Error fetching friends:", err);
      setFriends([]);
    }
  }, [userId]);

  // Inbox = active conversations. The server already filters out conversations
  // with no `lastMessageAt`, so this list only contains channels that have at
  // least one message — exactly what we want to show.
  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/conversations");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setInbox(data.conversations ?? []);
    } catch {
      /* silent */
    }
  }, []);

  // Single mount-time loader: kicks both fetches off in parallel via
  // Promise.all and flips the loading flags together. Page becomes
  // interactive in one round-trip's worth of wait.
  useEffect(() => {
    if (!authed) return;
    setLoadingFriends(true);
    setLoadingInbox(true);
    Promise.all([fetchFriends(), fetchInbox()]).finally(() => {
      setLoadingFriends(false);
      setLoadingInbox(false);
    });
  }, [authed, fetchFriends, fetchInbox]);

  // Poll inbox every 15s; pause when tab hidden, catch up on focus.
  useEffect(() => {
    if (!authed) return;
    const tick = () => !document.hidden && fetchInbox();
    const id = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [authed, fetchInbox]);

  const addFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const friendId = friendIdInput.trim();
    if (!friendId) return;
    setAddingFriend(true);
    setAddError("");
    try {
      const res = await fetch("/api/friends/addFriend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });
      if (!res.ok) {
        setAddError("Could not link. Check the handle ID and retry.");
        return;
      }
      setFriendIdInput("");
      await fetchFriends();
    } catch {
      setAddError("Connection failed.");
    } finally {
      setAddingFriend(false);
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const res = await fetch("/api/friends/removeFriend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });
      if (!res.ok) throw new Error();
      await fetchFriends();
    } catch {
      /* silent */
    } finally {
      setRemovingId(null);
    }
  };

  const handleLeaveChat = async ( conversationId: string) => {
    if (!conversationId) return;

    try {
      const res = await fetch(
        `/api/messages/${encodeURIComponent(conversationId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();
      await fetchInbox();
    } catch {
      /* silent */
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            <span className="blink">●</span> Loading mailboxes...
          </p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            &gt; Authenticate to open the mailroom.
          </p>
        </div>
      </div>
    );
  }

  // Total unread used in the inbox header.
  const totalUnread = inbox.reduce(
    (sum, e) => sum + (e.unreadCount > 0 ? 1 : 0),
    0,
  );

  // Filter inbox by search query. Matches conversation label + last
  // message preview, both lowercased. Empty query = all conversations.
  const filteredInbox = (() => {
    const q = inboxQuery.trim().toLowerCase();
    if (!q) return inbox;
    return inbox.filter((entry) => {
      const label = entryLabel(entry).toLowerCase();
      const preview = (entry.lastMessagePreview ?? "").toLowerCase();
      return label.includes(q) || preview.includes(q);
    });
  })();

  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
            ┌─ Mailroom · /sys/comms
          </p>
          <h1 className="font-display font-black text-4xl sm:text-5xl mt-3 tracking-tight">
            <span className="text-[color:var(--fg)]">MESSAGES</span>
            <span className="text-[color:var(--neon-magenta)] dark:glow-magenta">_</span>
          </h1>
          <p className="text-sm text-[color:var(--fg-muted)] mt-2 max-w-lg">
            Friends rail on the left, inbox on the right. Both load in
            parallel — no clicking through tabs to find things.
          </p>
        </div>

        {/* Two-pane layout: friends sidebar (left) + inbox (right). On
            mobile (< lg) the columns stack — friends rail above inbox. */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr] items-start">

          {/* ============== LEFT PANE: FRIENDS RAIL ============== */}
          <aside className="space-y-6 lg:sticky lg:top-4">
            {/* Operators */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[color:var(--border)]">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                  &gt; Operators
                </p>
                {!loadingFriends && friends.length > 0 && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                    {friends.length}
                  </span>
                )}
              </div>

              <div className="mt-3">
                {loadingFriends ? (
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-1 animate-pulse"
                      >
                        <div className="w-12 h-12 hud-clip bg-[color:var(--surface-2)]" />
                        <div className="h-2 w-10 bg-[color:var(--surface-2)]" />
                      </div>
                    ))}
                  </div>
                ) : friends.length === 0 ? (
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] py-3">
                    &gt; None linked yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {friends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex flex-col items-center gap-1 group relative"
                      >
                        {removingId === friend.id ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 hud-clip border border-[color:var(--neon-magenta)] bg-[color:var(--surface-2)] flex items-center justify-center">
                              <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-[color:var(--neon-magenta)] text-center leading-tight px-1">
                                Drop?
                              </span>
                            </div>
                            <div className="flex gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em]">
                              <button
                                onClick={() => removeFriend(friend.id)}
                                className="text-[color:var(--neon-magenta)] hover:underline"
                              >
                                Yes
                              </button>
                              <span className="text-[color:var(--border-strong)]">/</span>
                              <button
                                onClick={() => setRemovingId(null)}
                                className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Link href={`/profile/${friend.id}`}>
                                <Avatar
                                  name={friend.name}
                                  image={friend.image}
                                  size={48}
                                />
                              </Link>
                              <button
                                onClick={() => setRemovingId(friend.id)}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-[color:var(--surface)] border border-[color:var(--border-strong)] text-[color:var(--fg-muted)] text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:border-[color:var(--neon-magenta)] hover:text-[color:var(--neon-magenta)]"
                                title="Unlink"
                              >
                                ×
                              </button>
                            </div>
                            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--fg-muted)] max-w-[60px] truncate text-center">
                              {friend.name}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add friend — compact form, always visible. */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)] pb-2 border-b border-[color:var(--border)]">
                &gt; Link Operator
              </p>
              <form onSubmit={addFriend} className="mt-3 space-y-2">
                <input
                  type="text"
                  value={friendIdInput}
                  onChange={(e) => setFriendIdInput(e.target.value)}
                  placeholder="handle id..."
                  className="w-full bg-[color:var(--surface)] border border-[color:var(--border-strong)] px-3 py-2 font-mono text-xs text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition"
                />
                <button
                  type="submit"
                  disabled={addingFriend || !friendIdInput.trim()}
                  className="w-full font-mono text-[10px] uppercase tracking-[0.22em] px-3 py-2 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition disabled:opacity-50"
                >
                  {addingFriend ? "Linking…" : "Link +"}
                </button>
              </form>
              {addError && (
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)] leading-relaxed">
                  ✕ {addError}
                </p>
              )}
            </div>
          </aside>

          {/* ============== RIGHT PANE: INBOX ============== */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[color:var(--border)]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                  &gt; Conversations
                </p>
                <p className="text-sm text-[color:var(--fg-muted)] mt-1">
                  {inbox.length} channel{inbox.length === 1 ? "" : "s"}
                  {totalUnread > 0 ? (
                    <>
                      {" · "}
                      <span className="text-[color:var(--neon-cyan)]">
                        {totalUnread} unread
                      </span>
                    </>
                  ) : (
                    " · all caught up"
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowChooseFriends(true)}
                disabled={friends.length === 0}
                className="font-mono text-xs uppercase tracking-[0.2em] px-3 py-2 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition disabled:opacity-40 disabled:cursor-not-allowed"
                title={friends.length === 0 ? "Add a friend first" : "Open new DM"}
              >
                + New DM
              </button>
            </div>

            {/* Search filter — only shown when there's something to filter */}
            {inbox.length > 4 && (
              <div className="mt-3 relative">
                <span
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--fg-muted)]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={inboxQuery}
                  onChange={(e) => setInboxQuery(e.target.value)}
                  placeholder="Filter conversations…"
                  className="w-full pl-9 pr-9 py-2 bg-[color:var(--surface-2)] border border-[color:var(--border)] focus:border-[color:var(--neon-cyan)] outline-none text-sm font-mono text-[color:var(--fg)] transition"
                />
                {inboxQuery && (
                  <button
                    onClick={() => setInboxQuery("")}
                    aria-label="Clear filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 font-mono text-[10px] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-magenta)]"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {showChooseFriends && (
              <ChooseFriends onClose={() => setShowChooseFriends(false)} />
            )}

            {loadingInbox ? (
              <ul className="mt-4 divide-y divide-[color:var(--border)] border-t border-b border-[color:var(--border)]">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="flex items-center gap-4 px-3 py-3 animate-pulse">
                    <div className="w-11 h-11 hud-clip bg-[color:var(--surface-2)]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-32 bg-[color:var(--surface-2)]" />
                      <div className="h-2 w-48 bg-[color:var(--surface-2)]" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : inbox.length === 0 ? (
              <div className="mt-6 border border-dashed border-[color:var(--border)] py-12 px-6 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                  &gt; No channels open
                </p>
                <p className="text-sm text-[color:var(--fg-muted)] mt-2 max-w-sm mx-auto">
                  {friends.length === 0
                    ? "Link an operator from the rail on the left, then open a DM."
                    : "Hit + New DM to start a conversation."}
                </p>
              </div>
            ) : filteredInbox.length === 0 ? (
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] text-center">
                ✕ No matches for &ldquo;{inboxQuery}&rdquo;
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[color:var(--border)] border-t border-b border-[color:var(--border)]">
              {filteredInbox.map((entry) => {
                const label = entryLabel(entry);
                const avatarName = entryAvatarName(entry);
                const avatarImage = entryAvatarImage(entry);
                const unread = entry.unreadCount > 0;
                
                return (
                  // `relative` so the absolute leave button anchors to the
                  // row; `group` so it can fade in on row hover.
                  <li key={entry.id} className="relative flex items-stretch group">
                    <Link
                      href={`/messages/${encodeURIComponent(entry.id)}`}
                      className="flex items-center gap-4 px-3 py-3 pr-10 hover:bg-[color:var(--surface-2)] transition flex-1 min-w-0"
                    >
                      <div className="relative">
                        <Avatar name={avatarName} image={avatarImage} size={44} />
                        {unread && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[color:var(--neon-cyan)] dark:glow-cyan" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`font-display text-sm truncate ${
                              unread ? "font-bold text-[color:var(--fg)]" : "font-medium text-[color:var(--fg)]"
                            }`}
                          >
                            {label}
                          </span>
                          {entry.lastMessageAt && (
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--fg-muted)] flex-shrink-0">
                              {formatTimestamp(entry.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            unread
                              ? "text-[color:var(--neon-cyan)] dark:glow-cyan"
                              : "text-[color:var(--fg-muted)]"
                          }`}
                        >
                          &gt; {entry.lastMessagePreview ?? ""}
                        </p>
                      </div>
                      <span className="font-mono text-[color:var(--fg-muted)] group-hover:text-[color:var(--neon-cyan)] transition-colors">
                        →
                      </span>
                    </Link>
                    {/* Leave button — sibling of the Link, not a child, so
                        it's valid HTML and clicks don't fight the row link. */}
                    <button
                      onClick={() => handleLeaveChat(entry.id)}
                      className="absolute top-1/2 -translate-y-1/2 right-2 w-6 h-6 bg-[color:var(--surface)] border border-[color:var(--border-strong)] text-[color:var(--fg-muted)] text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:border-[color:var(--neon-magenta)] hover:text-[color:var(--neon-magenta)]"
                      title="Leave conversation"
                      aria-label="Leave conversation"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          </section>
        </div>
      </main>
    </div>
  );
}
