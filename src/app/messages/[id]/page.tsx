"use client";

import Navbar from "@/components/navbar";
import HudPanel from "@/components/HudPanel";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
}

// Mirrors the GET /api/messages/[conversationId] payload.
interface Conversation {
  id: string;
  type: "dm" | "group";
  participants: string[];
  otherUsers: { id: string; name: string }[];
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

// Channel display name: peer for DM, comma-joined for group, fallback to id.
function channelLabel(conv: Conversation | null, fallbackId: string): string {
  if (!conv) return "Channel";
  if (conv.otherUsers.length === 0) return "Empty channel";
  if (conv.type === "dm") return conv.otherUsers[0].name;
  return conv.otherUsers.map((u) => u.name).join(", ") || fallbackId;
}

export default function MessagePage() {
  // params.id is now the CONVERSATION id (was friendId in the old flow).
  const params = useParams<{ id: string }>();
  const conversationId = params?.id;
  const { data: session, status } = useSession();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const userId = session?.user?.id;

  // Initial load: messages + conversation metadata in one shot.
  // Server includes conversation hydration when there's no `before` cursor.
  useEffect(() => {
    if (status !== "authenticated" || !userId || !conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/messages/${encodeURIComponent(conversationId)}`,
        );
        if (!res.ok) {
          if (res.status === 403) setError("You're not in this channel.");
          else if (res.status === 404) setError("Channel not found.");
          else setError("Could not open channel.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setConversation(data.conversation ?? null);
        setMessages(data.messages ?? []);
        setNextBefore(data.nextBefore ?? null);
        // Fire-and-forget read receipt.
        fetch(
          `/api/messages/${encodeURIComponent(conversationId)}/read`,
          { method: "POST" },
        );
      } catch {
        setError("Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, userId, conversationId]);

  // Stick to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const loadOlder = async () => {
    if (!conversationId || nextBefore === null) return;
    const res = await fetch(
      `/api/messages/${encodeURIComponent(conversationId)}?before=${nextBefore}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    setMessages((prev) => [...data.messages, ...prev]);
    setNextBefore(data.nextBefore);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversationId || !draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/messages/${encodeURIComponent(conversationId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: draft }),
        },
      );
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

  const channelName = channelLabel(conversation, conversationId ?? "");
  const peerAccent = accentFor(conversation?.otherUsers[0]?.id ?? channelName);

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
          <Avatar name={channelName} size={52} />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
              ┌─ Channel · {conversation?.type === "group" ? "GROUP" : "DM"}
            </p>
            <h1 className="font-display font-bold text-2xl text-[color:var(--fg)] truncate">
              {channelName}
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
                        {channelName}
                      </p>
                    )}
                    {group.messages.map((m) => (
                      <div
                        key={m.senderId}
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
