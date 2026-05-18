"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/useAuth";

interface Msg { userId: string; name: string; text: string; ts: number }

export default function GameChat({ roomId }: { roomId: string }) {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("chat:join", roomId);
    const onMsg = (m: Msg) => setMessages((p) => [...p, m]);
    socket.on("chat:message", onMsg);
    return () => {
      socket.emit("chat:leave", roomId);
      socket.off("chat:message", onMsg);
    };
  }, [roomId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    getSocket().emit("chat:send", { roomId, text });
    setDraft("");
  };

  return (
    <div className="fixed bottom-4 right-4 w-72 border border-[color:var(--border-strong)] bg-[color:var(--surface)] z-40 shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[color:var(--surface-2)] border-b border-[color:var(--border)] font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]"
      >
        <span>▸ Chat</span>
        <span>{open ? "▾" : "▴"}</span>
      </button>
      {open && (
        <>
          <div ref={scrollRef} className="h-48 overflow-y-auto px-3 py-2 space-y-1 font-mono text-xs">
            {messages.length === 0 ? (
              <p className="text-[color:var(--fg-muted)] text-center pt-12">
                &gt; ephemeral · lost on disconnect
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="break-words leading-snug">
                  <span className={m.userId === userId ? "text-[color:var(--neon-cyan)]" : "text-[color:var(--neon-magenta)]"}>
                    {m.name}:
                  </span>{" "}
                  <span className="text-[color:var(--fg)]">{m.text}</span>
                </div>
              ))
            )}
          </div>
          <form onSubmit={send} className="flex border-t border-[color:var(--border)]">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type…"
              maxLength={500}
              className="flex-1 bg-transparent px-3 py-2 font-mono text-xs outline-none text-[color:var(--fg)]"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-3 bg-[color:var(--neon-cyan)] text-black font-mono text-[10px] uppercase tracking-[0.22em] disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
