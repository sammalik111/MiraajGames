"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";


interface Props {
  onClose: () => void;
}

export default function DeleteAccountPopup({ onClose }: Props) {
  const router = useRouter();
  const [inputConfirmation, setInputConfirmation] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const { data: session } = useSession();

  useEffect(() => {
    const myID = session?.user?.id;
    if (!myID) throw new Error("No user ID in session");
  }, []);

  // Esc to dismiss — small ergonomics win for a modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);



  const handleConfirm = async () => {
    try {
        // Call the API route to delete the account, which will also handle signing the user out and cleaning up their data.
        const res = await fetch("/api/auth/deleteAccount", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputData: inputConfirmation }),
        });
        const { success } = await res.json();
        if (success) {
            onClose();
            await signOut({ redirect: false });
            router.push(`/`);
        } else {
            setError("Failed to delete account");
        }
    } catch {
      setError("Network error. Please try again.");
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
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-magenta)] transition"
            aria-label="Close"
          >
            [esc]
          </button>
        </div>

        <input
          type="password"
          placeholder="Type current password to confirm"
          value={inputConfirmation}
          onChange={(e) => setInputConfirmation(e.target.value)}
          autoFocus
          className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] px-3 py-2 font-mono text-sm text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition"
        />

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
            className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-2 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition disabled:opacity-40"
          >
            {creating ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
};
