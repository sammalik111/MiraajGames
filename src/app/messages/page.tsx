"use client";

import Navbar from "@/components/navbar";
import HudPanel from "@/components/HudPanel";
import ChooseFriends from "@/components/chooseFriends";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Friend {
  id: string;
  name: string;
  image?: string;
}

// Shape returned by GET /api/messages/conversations.
interface InboxEntry {
  id: string; // conversation id — used for the link target
  type: "dm" | "group";
  participants: string[];
  otherUsers: { id: string; name: string }[];
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

// "DM with X" / group label. Joins names for groups; falls back to first
// other user for DMs.
function entryLabel(entry: InboxEntry): string {
  if (entry.otherUsers.length === 0) return "Empty channel";
  if (entry.type === "dm") return entry.otherUsers[0].name;
  return entry.otherUsers.map((u) => u.name).join(", ");
}

function entryAvatarName(entry: InboxEntry): string {
  return entry.otherUsers[0]?.name ?? "?";
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const [friendIdInput, setFriendIdInput] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [addError, setAddError] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showChooseFriends, setShowChooseFriends] = useState(false);

  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    try {
      const res = await fetch("/api/auth/getFriends");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFriends(data.friends ?? []);
    } catch {
      /* silent */
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  // Inbox = active conversations. The server already filters out conversations
  // with no `lastMessageAt`, so this list only contains channels that have at
  // least one message — exactly what we want to show.
  const fetchInbox = useCallback(async () => {
    setLoadingInbox(true);
    try {
      const res = await fetch("/api/messages/conversations");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setInbox(data.conversations ?? []);
    } catch {
      /* silent */
    } finally {
      setLoadingInbox(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchFriends();
      fetchInbox();
    }
  }, [status, fetchFriends, fetchInbox]);

  const addFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const friendId = friendIdInput.trim();
    if (!friendId) return;
    setAddingFriend(true);
    setAddError("");
    try {
      const res = await fetch("/api/auth/addFriend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session?.user?.id, friendId }),
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
      const res = await fetch("/api/auth/removeFriend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session?.user?.id, friendId }),
      });
      if (!res.ok) throw new Error();
      await fetchFriends();
    } catch {
      /* silent */
    } finally {
      setRemovingId(null);
    }
  };

  if (status === "loading") {
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

  if (!session) {
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

  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />
      <main className="relative z-10 max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-10">
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
            Link with other operators by handle ID, then drop into a DM channel.
          </p>
        </div>

        {/* Add friend */}
        <section>
          <div className="flex items-end justify-between pb-3 border-b border-[color:var(--border)]">
            <h2 className="font-display font-bold text-lg text-[color:var(--fg)]">
              <span className="text-[color:var(--neon-cyan)] dark:glow-cyan">&gt;</span> Link New Operator
            </h2>
          </div>
          <form onSubmit={addFriend} className="mt-4 flex gap-2">
            <input
              type="text"
              value={friendIdInput}
              onChange={(e) => setFriendIdInput(e.target.value)}
              placeholder="operator handle id..."
              className="flex-1 bg-[color:var(--surface)] border border-[color:var(--border-strong)] px-4 py-3 font-mono text-sm text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition"
            />
            <button
              type="submit"
              disabled={addingFriend || !friendIdInput.trim()}
              className="font-mono text-xs uppercase tracking-[0.2em] px-5 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition disabled:opacity-50"
            >
              {addingFriend ? "Linking…" : "Link +"}
            </button>
          </form>
          {addError && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
              ✕ {addError}
            </p>
          )}
        </section>

        {/* Allies — display only. No link to a conversation; future profile
            page will live behind clicking the avatar. */}
        <section>
          <div className="flex items-end justify-between pb-3 border-b border-[color:var(--border)]">
            <h2 className="font-display font-bold text-lg text-[color:var(--fg)]">
              <span className="text-[color:var(--neon-cyan)] dark:glow-cyan">&gt;</span> Allies
            </h2>
            {!loadingFriends && friends.length > 0 && (
              <span className="hud-chip">{friends.length} linked</span>
            )}
          </div>

          <div className="mt-4">
            {loadingFriends ? (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0 animate-pulse">
                    <div className="w-14 h-14 hud-clip bg-[color:var(--surface-2)]" />
                    <div className="h-2 w-12 bg-[color:var(--surface-2)]" />
                  </div>
                ))}
              </div>
            ) : friends.length === 0 ? (
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
                &gt; No allies linked. Add one above to bootstrap.
              </p>
            ) : (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 group relative">
                    {removingId === friend.id ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-14 h-14 hud-clip border border-[color:var(--neon-magenta)] bg-[color:var(--surface-2)] flex items-center justify-center">
                          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--neon-magenta)] text-center leading-tight px-1">
                            Drop?
                          </span>
                        </div>
                        <div className="flex gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
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
                          {/* Avatar is intentionally not a link yet —
                              clicking will open the public profile page once
                              that route exists. */}
                          <Avatar name={friend.name} image={friend.image} size={56} />
                          <button
                            onClick={() => setRemovingId(friend.id)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-[color:var(--surface)] border border-[color:var(--border-strong)] text-[color:var(--fg-muted)] text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:border-[color:var(--neon-magenta)] hover:text-[color:var(--neon-magenta)]"
                            title="Unlink"
                          >
                            ×
                          </button>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--fg-muted)] max-w-[72px] truncate text-center">
                          {friend.name}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Inbox — active conversations only (server filters out empty ones). */}
        <section>
          <div className="flex items-end justify-between pb-3 border-b border-[color:var(--border)]">
            <h2 className="font-display font-bold text-lg text-[color:var(--fg)]">
              <span className="text-[color:var(--neon-cyan)] dark:glow-cyan">&gt;</span> Inbox
            </h2>
            <div className="flex items-center gap-3">
              <span className="hud-chip">{inbox.length} channels</span>
              <button
                onClick={() => setShowChooseFriends(true)}
                className="font-mono text-xs uppercase tracking-[0.2em] px-3 py-1.5 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
              >
                Open DM +
              </button>
            </div>
          </div>

          {showChooseFriends && (
            <ChooseFriends onClose={() => setShowChooseFriends(false)} />
          )}

          {loadingInbox ? (
            <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
              <span className="blink">●</span> Loading channels...
            </p>
          ) : inbox.length === 0 ? (
            <HudPanel className="mt-4" innerClassName="p-8 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                &gt; No channels open. Hit &ldquo;Open DM&rdquo; to start one.
              </p>
            </HudPanel>
          ) : (
            <ul className="mt-4 divide-y divide-[color:var(--border)] border-t border-b border-[color:var(--border)]">
              {inbox.map((entry) => {
                const label = entryLabel(entry);
                const avatarName = entryAvatarName(entry);
                const unread = entry.unreadCount > 0;
                
                return (
                  <li key={entry.id} className="flex items-stretch group">
                    <Link
                      href={`/messages/${encodeURIComponent(entry.id)}`}
                      className="flex items-center gap-4 px-3 py-3 hover:bg-[color:var(--surface-2)] transition flex-1 min-w-0"
                    >
                      <div className="relative">
                        <Avatar name={avatarName} size={44} />
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
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
