"use client";

// One-on-one and group chat surface. Reads + writes messages for a
// single conversation, with:
//   - Smart message grouping (consecutive messages from the same sender
//     coalesce into a single bubble cluster, with avatar + name shown
//     once per cluster instead of repeating).
//   - Day separators ("Today", "Yesterday", or full date).
//   - Auto-resizing composer that supports multi-line drafts.
//   - Enter to send, Shift+Enter for newline.
//   - Hover any bubble to see its full timestamp tooltip.

import Navbar from "@/components/navbar";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface Message {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
}

interface Conversation {
  id: string;
  type: "dm" | "group";
  name: string | null;
  participants: string[];
  otherUsers: { id: string; name: string }[];
}

// ---- Time helpers -----------------------------------------------------
function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullTimestamp(ts: number) {
  return new Date(ts).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "Today" / "Yesterday" / "Mar 14" — used for date separators.
function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

// Stable color assignment per sender id so each peer gets a consistent
// accent across the whole conversation.
function accentFor(s: string) {
  const accents = [
    "var(--neon-cyan)",
    "var(--neon-magenta)",
    "var(--neon-yellow)",
    "var(--neon-lime)",
  ];
  return accents[(s.charCodeAt(0) || 0) % accents.length];
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials =
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";
  const accent = accentFor(name);
  return (
    <div
      className="hud-clip flex items-center justify-center flex-shrink-0 font-display font-black text-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: accent,
        boxShadow: `0 0 8px -3px ${accent}`,
      }}
    >
      {initials}
    </div>
  );
}

function channelLabel(conv: Conversation | null, fallbackId: string): string {
  if (!conv) return "Channel";
  if (conv.type === "group") {
    if (conv.name) return conv.name;
    if (conv.otherUsers.length === 0) return "Empty channel";
    return conv.otherUsers.map((u) => u.name).join(", ") || fallbackId;
  }
  if (conv.otherUsers.length === 0) return "Empty channel";
  return conv.otherUsers[0].name;
}

// ---- Visual grouping ---------------------------------------------------
// Each "cluster" = consecutive messages from the same sender within a
// short time window. We start a new cluster either on sender change OR
// after a 5-minute gap, so a long pause feels like a new burst.
const CLUSTER_GAP_MS = 5 * 60 * 1000;

interface Cluster {
  senderId: string | null;
  startedAt: number;
  messages: Message[];
}

function clusterMessages(messages: Message[]): Cluster[] {
  const out: Cluster[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    const gap = last ? m.createdAt - last.messages[last.messages.length - 1].createdAt : 0;
    if (last && last.senderId === m.senderId && gap < CLUSTER_GAP_MS) {
      last.messages.push(m);
    } else {
      out.push({ senderId: m.senderId, startedAt: m.createdAt, messages: [m] });
    }
  }
  return out;
}

// Group clusters by day for date-separator rendering.
interface DayBucket {
  label: string;
  clusters: Cluster[];
}

function bucketByDay(clusters: Cluster[]): DayBucket[] {
  const out: DayBucket[] = [];
  for (const c of clusters) {
    const label = dayLabel(c.startedAt);
    const last = out[out.length - 1];
    if (last && last.label === label) {
      last.clusters.push(c);
    } else {
      out.push({ label, clusters: [c] });
    }
  }
  return out;
}

// ---- Page --------------------------------------------------------------
export default function MessagePage() {
  const params = useParams<{ id: string }>();
  const conversationId = params?.id;
  const { userId, authed, loading } = useAuth();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Initial load: messages + conversation metadata in one shot.
  useEffect(() => {
    if (!authed || !userId || !conversationId) return;
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
        fetch(`/api/messages/${encodeURIComponent(conversationId)}/read`, {
          method: "POST",
        });
      } catch {
        setError("Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, userId, conversationId]);

  // Auto-scroll to bottom on new messages, but only if already near it —
  // don't yank users who've scrolled up to read history.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 80) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Poll active chat every 5s; pause when hidden, catch up on focus.
  // Merge by id so locally-rendered messages aren't duplicated.
  useEffect(() => {
    if (!authed || !userId || !conversationId) return;
    const tick = async () => {
      if (document.hidden) return;
      const res = await fetch(`/api/messages/${encodeURIComponent(conversationId)}`).catch(() => null);
      if (!res?.ok) return;
      const { messages: incoming = [] } = await res.json();
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const added = incoming.filter((m: Message) => !seen.has(m.id));
        return added.length ? [...prev, ...added].sort((a, b) => a.createdAt - b.createdAt) : prev;
      });
      fetch(`/api/messages/${encodeURIComponent(conversationId)}/read`, { method: "POST" });
    };
    const id = window.setInterval(tick, 5_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [authed, userId, conversationId]);

  // Auto-resize the composer as the user types.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 160; // ~5 lines before scrolling internally
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [draft]);

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

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!conversationId || !text || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(
        `/api/messages/${encodeURIComponent(conversationId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
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

  // Enter sends, Shift+Enter inserts a newline.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Sender id → display name lookup. Used to show names on group
  // chat clusters from peers we know about.
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    if (conversation) {
      for (const u of conversation.otherUsers) map.set(u.id, u.name);
    }
    return map;
  }, [conversation]);

  const clusters = useMemo(() => clusterMessages(messages), [messages]);
  const days = useMemo(() => bucketByDay(clusters), [clusters]);

  if (loading) {
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

  if (!authed) {
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
  const isGroup = conversation?.type === "group";

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
          <Avatar name={channelName} size={48} />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
              {isGroup ? "Group channel" : "Direct"} ·{" "}
              <span className="text-[color:var(--fg-muted)]">
                {(conversation?.otherUsers.length ?? 0) + 1}{" "}
                participant{(conversation?.otherUsers.length ?? 0) === 0 ? "" : "s"}
              </span>
            </p>
            <h1 className="font-display font-bold text-2xl text-[color:var(--fg)] truncate">
              {channelName}
            </h1>
            {/* For groups, show member chips so you can see who's in the room. */}
            {isGroup && conversation && conversation.otherUsers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {conversation.otherUsers.slice(0, 6).map((u) => (
                  <span
                    key={u.id}
                    className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 border border-[color:var(--border)] text-[color:var(--fg-muted)]"
                    style={{ borderColor: accentFor(u.id) + "55" }}
                  >
                    {u.name}
                  </span>
                ))}
                {conversation.otherUsers.length > 6 && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 text-[color:var(--fg-muted)]">
                    +{conversation.otherUsers.length - 6} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="hud-chip self-start">
            <span className="text-[color:var(--neon-lime)]">●</span> Encrypted
          </div>
        </div>

        {/* Chat surface */}
        <div className="mt-6 border border-[color:var(--border-strong)] bg-[color:var(--surface)]">
          <div
            ref={scrollRef}
            className="h-[60vh] overflow-y-auto px-4 sm:px-6 py-5"
          >
            {nextBefore !== null && (
              <div className="text-center mb-4">
                <button
                  onClick={loadOlder}
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-cyan)] transition px-3 py-1.5 border border-[color:var(--border)]"
                >
                  ↑ Load older
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <EmptyChannel name={channelName} />
            ) : (
              <div className="space-y-6">
                {days.map((day, di) => (
                  <div key={di} className="space-y-4">
                    {/* Day separator */}
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px bg-[color:var(--border)]" />
                      <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
                        {day.label}
                      </span>
                      <div className="flex-1 h-px bg-[color:var(--border)]" />
                    </div>

                    {day.clusters.map((cluster, ci) => (
                      <ClusterView
                        key={`${di}-${ci}`}
                        cluster={cluster}
                        currentUserId={userId}
                        nameById={nameById}
                        showSenderName={isGroup}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={send}
            className="border-t border-[color:var(--border)] bg-[color:var(--surface-2)]"
          >
            <div className="flex items-end gap-2 px-3 py-3">
              <textarea
                ref={composerRef}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Send a message…   (Enter to send · Shift+Enter for newline)"
                disabled={!conversation || sending}
                className="flex-1 resize-none bg-transparent px-2 py-2 font-mono text-sm text-[color:var(--fg)] outline-none disabled:opacity-50 leading-relaxed"
                style={{ maxHeight: 160 }}
              />
              <button
                type="submit"
                disabled={!conversation || !draft.trim() || sending}
                className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-2.5 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition disabled:opacity-40 self-end"
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
          </form>
        </div>

        {error && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
            ✕ {error}
          </p>
        )}
      </main>
    </div>
  );
}

// ---- Cluster view: avatar + stack of bubbles ---------------------------
function ClusterView({
  cluster,
  currentUserId,
  nameById,
  showSenderName,
}: {
  cluster: Cluster;
  currentUserId: string | null;
  nameById: Map<string, string>;
  showSenderName: boolean;
}) {
  const mine = !!cluster.senderId && cluster.senderId === currentUserId;
  const senderName = cluster.senderId
    ? nameById.get(cluster.senderId) ?? "Unknown"
    : "Unknown";
  const accent = cluster.senderId ? accentFor(cluster.senderId) : "var(--fg-muted)";

  return (
    <div className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
      {/* Avatar — only for opponent clusters */}
      {!mine && (
        <div className="flex-shrink-0 pt-0.5">
          <Avatar name={senderName} size={32} />
        </div>
      )}

      <div className={`flex-1 min-w-0 ${mine ? "items-end" : "items-start"}`}>
        {/* Sender label — for groups, or always for opponent */}
        {!mine && showSenderName && (
          <p
            className="font-mono text-[10px] uppercase tracking-[0.22em] mb-1"
            style={{ color: accent }}
          >
            {senderName}
          </p>
        )}

        <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
          {cluster.messages.map((m, i) => {
            const isFirst = i === 0;
            const isLast = i === cluster.messages.length - 1;
            return (
              <div
                key={m.id}
                title={formatFullTimestamp(m.createdAt)}
                data-chat-bubble={mine ? "mine" : "theirs"}
                className={`group max-w-[85%] sm:max-w-[75%] px-3.5 py-2 text-sm leading-6 break-words transition ${
                  mine
                    ? "bg-[color:var(--neon-cyan)] text-black"
                    : "bg-[color:var(--surface-2)] text-[color:var(--fg)] border border-[color:var(--border)]"
                }`}
                style={{
                  // Bubble corner radii: round the outer corners of the
                  // first/last bubbles in a cluster more than the middle
                  // ones, giving a "stacked" feel for adjacent messages.
                  borderRadius: mine
                    ? `${isFirst ? 14 : 4}px ${isFirst ? 14 : 4}px 4px ${isLast ? 14 : 4}px`
                    : `${isFirst ? 14 : 4}px ${isFirst ? 14 : 4}px ${isLast ? 14 : 4}px 4px`,
                }}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              </div>
            );
          })}
        </div>

        {/* Cluster timestamp — single line at the bottom of the group */}
        <p
          className={`mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] ${
            mine ? "text-right" : ""
          }`}
        >
          {formatTime(cluster.messages[cluster.messages.length - 1].createdAt)}
          {cluster.messages.some((m) => m.editedAt) && (
            <span className="ml-1 opacity-70">· edited</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ---- Empty channel placeholder ----------------------------------------
function EmptyChannel({ name }: { name: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-10 gap-4">
      <Avatar name={name} size={56} />
      <div>
        <p className="font-display font-bold text-lg text-[color:var(--fg)]">
          {name}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] mt-1">
          No packets yet — drop the first one
        </p>
      </div>
    </div>
  );
}
