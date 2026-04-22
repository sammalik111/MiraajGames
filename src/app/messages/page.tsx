"use client";

import Navbar from "@/components/navbar";
import HudPanel from "@/components/HudPanel";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Friend {
  id: string;
  name: string;
  image?: string;
}

interface RecentMessage {
  friendId: string;
  friendName: string;
  friendImage?: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
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

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [friendIdInput, setFriendIdInput] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [addError, setAddError] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchFriends = async () => {
    setLoadingFriends(true);
    try {
      const res = await fetch("/api/auth/getFriends");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFriends(data.friends ?? []);
      setRecentMessages(
        (data.friends ?? []).map((f: Friend) => ({
          friendId: f.id,
          friendName: f.name,
          friendImage: f.image,
          lastMessage: "No messages yet",
          timestamp: "",
          unread: false,
        }))
      );
    } catch {
      /* silent */
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchFriends();
  }, [status]);

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

        {/* Allies scroll */}
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
                          <Link href={`/messages/${friend.id}`} className="block transition-all">
                            <Avatar name={friend.name} image={friend.image} size={56} />
                          </Link>
                          <button
                            onClick={() => setRemovingId(friend.id)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-[color:var(--surface)] border border-[color:var(--border-strong)] text-[color:var(--fg-muted)] text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:border-[color:var(--neon-magenta)] hover:text-[color:var(--neon-magenta)]"
                            title="Unlink"
                          >
                            ×
                          </button>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--fg-muted)] group-hover:text-[color:var(--neon-cyan)] transition-colors max-w-[72px] truncate text-center">
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

        {/* Inbox */}
        <section>
          <div className="flex items-end justify-between pb-3 border-b border-[color:var(--border)]">
            <h2 className="font-display font-bold text-lg text-[color:var(--fg)]">
              <span className="text-[color:var(--neon-cyan)] dark:glow-cyan">&gt;</span> Inbox
            </h2>
            <span className="hud-chip">{recentMessages.length} channels</span>
          </div>

          {recentMessages.length === 0 ? (
            <HudPanel className="mt-4" innerClassName="p-8 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                &gt; No channels open. Link an ally to start a DM.
              </p>
            </HudPanel>
          ) : (
            <ul className="mt-4 divide-y divide-[color:var(--border)] border-t border-b border-[color:var(--border)]">
              {recentMessages.map((msg) => (
                <li key={msg.friendId} className="flex items-stretch group">
                  <Link
                    href={`/messages/${msg.friendId}`}
                    className="flex items-center gap-4 px-3 py-3 hover:bg-[color:var(--surface-2)] transition flex-1 min-w-0"
                  >
                    <div className="relative">
                      <Avatar name={msg.friendName} image={msg.friendImage} size={44} />
                      {msg.unread && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[color:var(--neon-cyan)] dark:glow-cyan" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`font-display text-sm truncate ${
                            msg.unread ? "font-bold text-[color:var(--fg)]" : "font-medium text-[color:var(--fg)]"
                          }`}
                        >
                          {msg.friendName}
                        </span>
                        {msg.timestamp && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--fg-muted)] flex-shrink-0">
                            {msg.timestamp}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          msg.unread
                            ? "text-[color:var(--neon-cyan)] dark:glow-cyan"
                            : "text-[color:var(--fg-muted)]"
                        }`}
                      >
                        &gt; {msg.lastMessage}
                      </p>
                    </div>
                    <span className="font-mono text-[color:var(--fg-muted)] group-hover:text-[color:var(--neon-cyan)] transition-colors">
                      →
                    </span>
                  </Link>
                  <button
                    onClick={() =>
                      setRemovingId(removingId === msg.friendId ? null : msg.friendId)
                    }
                    className="px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)] opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    {removingId === msg.friendId ? (
                      <span className="flex gap-2 items-center">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFriend(msg.friendId);
                          }}
                          className="text-[color:var(--neon-magenta)] hover:underline cursor-pointer"
                        >
                          Drop
                        </span>
                        <span className="text-[color:var(--border-strong)]">/</span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemovingId(null);
                          }}
                          className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] cursor-pointer"
                        >
                          Keep
                        </span>
                      </span>
                    ) : (
                      "×"
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
