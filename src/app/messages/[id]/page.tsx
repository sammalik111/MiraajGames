"use client";

import Navbar from "@/components/navbar";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getUserById } from "@/components/getUserById";

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
}

interface Conversation {
  id: string;
  type: "dm" | "group";
  participants: string[];
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


export default function MessagePage() {
  const params = useParams<{ id: string }>();
  const friendId = params?.id;
  const [friendObject, setFriendObject] = useState<{ id: string; name?: string; email?: string } | null>(null);
  const { data: session, status } = useSession();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const userId = session?.user?.id;

  // Resolve (or create) the DM conversation with this friend.
  useEffect(() => {
    if (status !== "authenticated" || !userId || !friendId  ) return;
    getUserById(friendId).then(setFriendObject);
    let cancelled = false;
    (async () => {
      try {
        console.log("Opening conversation with friendId:", friendId);
        const res = await fetch("/api/messages/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ friendId }),
        });
        if (!res.ok) {
          setError("Could not open this conversation.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setConversation(data.conversation);
      } catch {
        setError("Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, userId, friendId]);

  // Load the latest page of messages once we know the conversation id.
  useEffect(() => {
    if (!conversation) return;
    let cancelled = false;
    (async () => {
      console.log("Loading messages for conversation:", conversation.id);
      const res = await fetch(`/api/messages/${encodeURIComponent(conversation.id)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;
      setMessages(data.messages);
      setNextBefore(data.nextBefore);
      // Mark read on open.
      fetch(`/api/messages/${encodeURIComponent(conversation.id)}/read`, { method: "POST" });
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation]);

  // Stick to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const loadOlder = async () => {
    if (!conversation || nextBefore === null) return;
    const res = await fetch(`/api/messages/${encodeURIComponent(conversation.id)}?before=${nextBefore}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages((prev) => [...data.messages, ...prev]);
    setNextBefore(data.nextBefore);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(conversation.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      if (!res.ok) {
        setError("Message failed to send.");
        return;
      }
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const grouped = useMemo(() => {
    // Collapse consecutive messages from the same sender for a cleaner bubble look.
    const out: { senderId: string; messages: Message[] }[] = [];
    for (const m of messages) {
      const last = out[out.length - 1];
      if (last && last.senderId === m.senderId) last.messages.push(m);
      else out.push({ senderId: m.senderId, messages: [m] });
    }
    return out;
  }, [messages]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Navbar />
        <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Navbar />
        <div className="container mx-auto p-8 text-center">
          <p className="text-slate-400">Please sign in to view your messages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/messages" className="text-sm text-violet-300 hover:text-violet-200">
            ← Back to Messages
          </Link>
          <h1 className="text-xl font-semibold">Chat with {friendObject?.name}</h1>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-slate-950/30">
          <div ref={scrollRef} className="h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
            {nextBefore !== null && (
              <div className="text-center">
                <button
                  onClick={loadOlder}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  Load older messages
                </button>
              </div>
            )}
            {messages.length === 0 && (
              <p className="text-center text-sm text-slate-500">No messages yet — say hi!</p>
            )}
            {grouped.map((group, gi) => {
              const mine = group.senderId === userId;
              return (
                <div key={gi} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[70%] space-y-1">
                    {group.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`px-4 py-2 rounded-2xl text-sm ${
                          mine
                            ? "bg-violet-500 text-white rounded-br-sm"
                            : "bg-slate-100 text-slate-900 rounded-bl-sm dark:bg-slate-800 dark:text-slate-100"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            mine ? "text-violet-200" : "text-slate-400"
                          }`}
                        >
                          {formatTime(m.createdAt)}
                          {m.editedAt && <span className="ml-1">(edited)</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={send} className="border-t border-slate-200 px-4 py-3 flex gap-2 dark:border-slate-800">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              disabled={!conversation || sending}
              className="flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={!conversation || !draft.trim() || sending}
              className="rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50"
            >
              {sending ? "…" : "Send"}
            </button>
          </form>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </main>
    </div>
  );
}