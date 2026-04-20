"use client";

import Navbar from "@/components/navbar";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
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

function Avatar({ name, image, size = 48 }: { name: string; image?: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["bg-blue-500","bg-purple-500","bg-green-500","bg-rose-500","bg-amber-500","bg-teal-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (image) {
    return <img src={image} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div className={`rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold ${color}`} style={{ width: size, height: size, fontSize: size * 0.35 }}>
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
  // NEW: track which friend ID is pending removal confirmation
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
      // silently fail
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
      if (!res.ok) { setAddError("Could not add friend. Check the ID and try again."); return; }
      setFriendIdInput("");
      await fetchFriends();
    } catch {
      setAddError("An error occurred.");
    } finally {
      setAddingFriend(false);
    }
  };

  // NEW: calls /api/auth/removeFriend then refreshes the list
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
      // silently fail — list stays unchanged
    } finally {
      setRemovingId(null);
    }
  };

  if (status === "loading") {
    return <div><Navbar /><div className="flex items-center justify-center h-64 text-slate-400">Loading…</div></div>;
  }

  if (!session) {
    return <div><Navbar /><div className="container mx-auto p-8 text-center"><p className="text-slate-500 text-lg">Please sign in to view your messages.</p></div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* Add Friend */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">Add Friend</h2>
          <form onSubmit={addFriend} className="flex gap-2">
            <input
              type="text"
              value={friendIdInput}
              onChange={(e) => setFriendIdInput(e.target.value)}
              placeholder="Enter friend's user ID"
              className="flex-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={addingFriend || !friendIdInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-5 rounded-xl transition-colors"
            >
              {addingFriend ? "Adding…" : "Add"}
            </button>
          </form>
          {addError && <p className="mt-2 text-sm text-red-500">{addError}</p>}
        </section>

        {/* Friends horizontal scroll */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">Friends</h2>
          {loadingFriends ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 animate-pulse">
                  <div className="w-14 h-14 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <div className="h-3 w-10 bg-slate-300 dark:bg-slate-700 rounded" />
                </div>
              ))}
            </div>
          ) : friends.length === 0 ? (
            <p className="text-sm text-slate-500">No friends added yet. Add one above to get started.</p>
          ) : (
            <div className="flex gap-5 overflow-x-auto pb-2">
              {friends.map((friend) => (
                // NEW: relative wrapper so the X button can be positioned over the avatar
                <div key={friend.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 group relative">
                  {removingId === friend.id ? (
                    // NEW: inline confirmation shown instead of the avatar
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <span className="text-xs text-slate-500 text-center leading-tight px-1">Sure?</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => removeFriend(friend.id)}
                          className="text-xs text-red-500 hover:text-red-600 font-medium"
                        >
                          Yes
                        </button>
                        <span className="text-slate-300 text-xs">/</span>
                        <button
                          onClick={() => setRemovingId(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Link href={`/messages/${friend.id}`} className="ring-2 ring-transparent group-hover:ring-blue-500 rounded-full transition-all block">
                          <Avatar name={friend.name} image={friend.image} size={56} />
                        </Link>
                        {/* NEW: X button, visible on hover */}
                        <button
                          onClick={() => setRemovingId(friend.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-700 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                          title="Remove friend"
                        >
                          ×
                        </button>
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-blue-500 transition-colors max-w-[60px] truncate text-center">
                        {friend.name}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent messages feed */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">Recent Messages</h2>
          {recentMessages.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-8 text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-slate-500 text-sm">No conversations yet. Add a friend and start chatting!</p>
            </div>
          ) : (
            <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {recentMessages.map((msg) => (
                <li key={msg.friendId} className="flex items-center group">
                  <Link href={`/messages/${msg.friendId}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex-1 min-w-0">
                    <div className="relative">
                      <Avatar name={msg.friendName} image={msg.friendImage} size={44} />
                      {msg.unread && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-sm font-medium truncate ${msg.unread ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-200"}`}>
                          {msg.friendName}
                        </span>
                        {msg.timestamp && <span className="text-xs text-slate-400 flex-shrink-0">{msg.timestamp}</span>}
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${msg.unread ? "text-slate-700 dark:text-slate-300 font-medium" : "text-slate-400"}`}>
                        {msg.lastMessage}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  {/* NEW: remove button on the right of each row, visible on hover */}
                  <button
                    onClick={() => setRemovingId(removingId === msg.friendId ? null : msg.friendId)}
                    className="px-3 py-3.5 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs font-medium flex-shrink-0"
                    title="Remove friend"
                  >
                    {removingId === msg.friendId ? (
                      <span className="flex gap-1 items-center">
                        <button onClick={(e) => { e.stopPropagation(); removeFriend(msg.friendId); }} className="text-red-500 hover:text-red-600 font-semibold">Remove</button>
                        <span className="text-slate-300">/</span>
                        <button onClick={(e) => { e.stopPropagation(); setRemovingId(null); }} className="text-slate-400 hover:text-slate-600">Cancel</button>
                      </span>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6h12a6 6 0 00-6-6zM21 12h-6" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </div>
  );
}