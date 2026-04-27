// Modal for picking a friend to DM. Calls POST /api/messages/conversation
// to create-or-get the conversation, then navigates to /messages/<conversationId>.
//
// Single-select for now. To support group chats later, swap `selectedId` for a
// Set<string>, change the API call to send `friendIds: string[]`, and have the
// API branch to `createGroup` when length > 1.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Friend {
  id: string;
  name: string;
}

interface Props {
  onClose: () => void;
}

export default function ChooseFriends({ onClose }: Props) {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/getFriends")
      .then((res) => res.json())
      .then((data) => setFriends(data.friends ?? []))
      .catch(() => setError("Could not load allies."))
      .finally(() => setLoading(false));
  }, []);

  // Esc to dismiss — small ergonomics win for a modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = friends.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleConfirm = async () => {
    if (!selectedIds || creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/messages/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendIds: selectedIds }),
      });
      if (!res.ok) {
        setError("Could not open channel.");
        return;
      }
      const data = await res.json();
      const convId = data?.conversation?.id;
      if (!convId) {
        setError("Malformed response.");
        return;
      }
      onClose();
      router.push(`/messages/${encodeURIComponent(convId)}`);
    } catch {
      setError("Network error.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      // backdrop click closes; stop-prop on inner card so clicks inside don't dismiss
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[color:var(--surface)] border border-[color:var(--border-strong)] p-5 space-y-4"
        style={{
          clipPath:
            "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
              ┌─ Open DM
            </p>
            <h2 className="font-display font-black text-xl mt-1 text-[color:var(--fg)]">
              Choose ally
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-magenta)] transition"
            aria-label="Close"
          >
            [esc]
          </button>
        </div>

        <input
          type="text"
          placeholder="search allies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] px-3 py-2 font-mono text-sm text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition"
        />

        <div className="max-h-64 overflow-y-auto border border-[color:var(--border)] divide-y divide-[color:var(--border)]">
          {loading ? (
            <p className="px-3 py-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
              <span className="blink">●</span> Scanning roster...
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
              &gt; No matches.
            </p>
          ) : (
            filtered.map((f) => {
              const selected = selectedIds?.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    if (selectedIds?.includes(f.id)) {
                      setSelectedIds(selectedIds.filter((id) => id !== f.id));
                    } else {
                      setSelectedIds([...(selectedIds || []), f.id]);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 font-mono text-sm transition ${
                    selected
                      ? "bg-[color:var(--neon-cyan)] text-black"
                      : "text-[color:var(--fg)] hover:bg-[color:var(--surface-2)]"
                  }`}
                >
                  {selected ? "▶ " : "  "}
                  {f.name}
                </button>
              );
            })
          )}
        </div>

        {error && (
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
            ✕ {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-2 border border-[color:var(--border-strong)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedIds || creating}
            className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-2 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition disabled:opacity-40"
          >
            {creating ? "Opening…" : "Open →"}
          </button>
        </div>
      </div>
    </div>
  );
}
