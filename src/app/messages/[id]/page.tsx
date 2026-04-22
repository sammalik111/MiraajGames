"use client";

import Navbar from "@/components/navbar";
import HudPanel from "@/components/HudPanel";
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

// Deterministic neon accent for an ID — used for peer avatar/handle.
function accentFor(s: string) {
  const accents = ["var(--neon-cyan)", "var(--neon-magenta)", "var(--neon-yellow)", "var(--neon-lime)"];
  return accents[(s.charCodeAt(0) || 0) % accents.length];
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??";
  const accent = accentFor(name);
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
    if (status !== "authenticated" || !userId || !friendId) return;
    getUserById(friendId).then(setFriendObject);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/messages/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ friendId }),
        });
        if (!res.ok) {
          setError("Could not open this channel.");
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
      const res = await fetch(`/api/messages/${encodeURIComponent(conversation.id)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;
      setMessages(data.messages);
      setNextBefore(data.nextBefore);
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
        setError("Packet lost. Retry.");
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
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            <span className="blink">●</span> Opening channel...
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
            &gt; Authenticate to open channels.
          </p>
        </div>
      </div>
    );
  }

  const friendName = friendObject?.name || "Operator";
  const peerAccent = accentFor(friendId || "x");

  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back crumb */}
        <Link
          href="/messages"
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-cyan)] transition"
        >
          ← Back to Mailroom
        </Link>

        {/* Channel header */}
        <div className="mt-4 flex items-center gap-4 pb-4 border-b border-[color:var(--border)]">
          <Avatar name={friendName} size={52} />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
              ┌─ Channel · DM
            </p>
            <h1 className="font-display font-bold text-2xl text-[color:var(--fg)] truncate">
              {friendName}
            </h1>
          </div>
          <div className="hud-chip">
            <span className="text-[color:var(--neon-lime)]">●</span> Encrypted
          </div>
        </div>

        {/* Chat surface */}
        <HudPanel className="mt-6" innerClassName="p-0">
          <div
            ref={scrollRef}
            className="h-[58vh] overflow-y-auto px-5 py-5 space-y-4 scanline-overlay"
          >
            {nextBefore !== null && (
              <div className="text-center">
                <button
                  onClick={loadOlder}
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-cyan)] transition"
                >
                  &lt; Load older packets
                </button>
              </div>
            )}

            {messages.length === 0 && (
              <p className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                &gt; Channel empty. Drop the first packet.
              </p>
            )}

            {grouped.map((group, gi) => {
              const mine = group.senderId === userId;
              return (
                <div key={gi} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[75%] space-y-1.5">
                    {!mine && gi === 0 && (
                      <p
                        className="font-mono text-[10px] uppercase tracking-[0.22em] ml-2"
                        style={{ color: peerAccent }}
                      >
                        {friendName}
                      </p>
                    )}
                    {group.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`px-4 py-2.5 text-sm leading-6 border ${
                          mine
                            ? "bg-[color:var(--neon-cyan)] text-black border-[color:var(--neon-cyan)]"
                            : "bg-[color:var(--surface-2)] text-[color:var(--fg)] border-[color:var(--border)]"
                        }`}
                        style={{
                          clipPath: mine
                            ? "polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)"
                            : "polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)",
                        }}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p
                          className={`mt-1 font-mono text-[9px] uppercase tracking-[0.2em] ${
                            mine ? "text-black/60" : "text-[color:var(--fg-muted)]"
                          }`}
                        >
                          {formatTime(m.createdAt)}
                          {m.editedAt && <span className="ml-1">· edited</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Composer */}
          <form
            onSubmit={send}
            className="border-t border-[color:var(--border)] px-3 py-3 flex gap-2 bg-[color:var(--surface-2)]"
          >
            <span className="font-mono text-sm text-[color:var(--neon-cyan)] self-center pl-1">
              &gt;
            </span>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="type a packet..."
              disabled={!conversation || sending}
              className="flex-1 bg-transparent px-2 py-2 font-mono text-sm text-[color:var(--fg)] outline-none disabled:opacity-50 placeholder:lowercase"
            />
            <button
              type="submit"
              disabled={!conversation || !draft.trim() || sending}
              className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-2 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition disabled:opacity-40"
            >
              {sending ? "…" : "Send →"}
            </button>
          </form>
        </HudPanel>

        {error && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
            ✕ {error}
          </p>
        )}
      </main>
    </div>
  );
}
