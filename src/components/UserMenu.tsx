"use client";

// User cluster on the right side of the navbar. When authed it's a single
// avatar button that opens a dropdown menu — anywhere a "user-scoped" thing
// lives (profile, inbox, settings, achievements, sign out) goes here. This
// keeps the main nav bar from growing every time a new account feature
// ships.
//
// When not authed it's a Sign In / Jack In pair, same as before.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";

interface MenuItem {
  href?: string;
  label: string;
  // Optional badge: e.g. unread count
  badge?: number | null;
  // For sign-out and other action items
  onClick?: () => void | Promise<void>;
  // Visual treatment — separator before this item
  divider?: boolean;
  // Color cue (e.g. magenta for sign-out)
  tone?: "default" | "danger";
}

// Shared monogram avatar — same accent assignment as elsewhere in the app
// (charCodeAt → palette mod). Falls through to <img> if a URL is available.
function MiniAvatar({
  name,
  image,
  size = 32,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  const initials =
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";
  const accents = [
    "var(--neon-cyan)",
    "var(--neon-magenta)",
    "var(--neon-yellow)",
    "var(--neon-lime)",
  ];
  const accent = accents[(name.charCodeAt(0) || 0) % accents.length];

  return (
    <div
      className="hud-clip flex items-center justify-center flex-shrink-0 font-display font-black text-black relative"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: accent,
        boxShadow: `0 0 8px -2px ${accent}`,
      }}
    >
      {image && (
        <img
          src={image}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover hud-clip"
          loading="eager"
          decoding="async"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <span className="relative">{initials}</span>
    </div>
  );
}

export default function UserMenu() {
  const { user, authed, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Outside-click + escape to close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Pull unread count from the inbox endpoint. Cheap (single query, no extra
  // round-trip — the inbox already needs this data) and it keeps the badge
  // accurate without spinning up a new endpoint.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch("/api/messages/conversations", {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const total = (data.entries ?? []).reduce(
          (sum: number, c: { unreadCount?: number }) =>
            sum + (c.unreadCount ?? 0),
          0,
        );
        if (!cancelled) setUnread(total);
      } catch {
        /* silent */
      }
    };
    refresh();
    // Re-check every 30s. Cheap and good enough for a passive badge.
    const t = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [authed]);

  const handleSignOut = async () => {
    try {
      const res = await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) window.location.href = "/";
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (loading) {
    // Skeleton avatar so layout doesn't jump on hydration.
    return (
      <div
        className="hud-clip"
        style={{
          width: 36,
          height: 36,
          background: "var(--surface-2)",
        }}
      />
    );
  }

  if (!authed) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/auth/signin"
          className="font-mono text-xs uppercase tracking-[0.2em] px-3 py-1.5 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:ring-cyan transition"
        >
          Sign In
        </Link>
        <Link
          href="/auth/signup"
          className="font-mono text-xs uppercase tracking-[0.2em] px-3 py-1.5 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
        >
          Jack In
        </Link>
      </div>
    );
  }

  // Display name for monogram. Uses NextAuth `user.name` if present, else
  // the email local-part, else "?".
  const userObj = user as { name?: string; email?: string; image?: string } | undefined;
  const displayName =
    userObj?.name || userObj?.email?.split("@")[0] || "?";
  const avatarUrl = userObj?.image ?? null;

  // Menu definition. To add a new user-scoped feature, drop a row here.
  // Order matters — this is the order they'll render.
  const items: MenuItem[] = [
    { href: "/profile", label: "Profile" },
    { href: "/messages", label: "Messages", badge: unread || null },
    { divider: true, label: "" },
    { href: "/contactUs", label: "Contact" },
    { divider: true, label: "" },
    { onClick: handleSignOut, label: "Sign Out", tone: "danger" },
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="User menu"
        aria-expanded={open}
        className="flex items-center gap-2 group"
      >
        <MiniAvatar name={displayName} image={avatarUrl} size={36} />
        {/* Hide name on small screens (mobile nav has it). Bare avatar on phones. */}
        <span className="hidden xl:flex flex-col leading-tight items-start">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            Player
          </span>
          <span className="font-mono text-xs text-[color:var(--fg)] group-hover:text-[color:var(--neon-cyan)] transition">
            {displayName}
          </span>
        </span>
        {/* Unread dot on the avatar itself — visible on every screen size */}
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[color:var(--neon-magenta)] ring-2 ring-[color:var(--bg)]"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 origin-top-right border border-[color:var(--border-strong)] bg-[color:var(--surface-1)] shadow-[0_0_40px_-10px_rgba(0,255,255,0.4)]"
          style={{
            animation: "menuOpen 160ms ease-out",
            clipPath:
              "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
          }}
        >
          <style jsx>{`
            @keyframes menuOpen {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Header strip — identity recap */}
          <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--surface-2)] flex items-center gap-3">
            <MiniAvatar name={displayName} image={avatarUrl} size={40} />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--neon-cyan)]">
                Logged In
              </p>
              <p className="font-mono text-sm text-[color:var(--fg)] truncate">
                {displayName}
              </p>
            </div>
          </div>

          {/* Menu items */}
          <ul className="py-1">
            {items.map((item, i) =>
              item.divider ? (
                <li
                  key={`divider-${i}`}
                  className="my-1 border-t border-[color:var(--border)]"
                  aria-hidden
                />
              ) : item.href ? (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] transition ${
                      item.tone === "danger"
                        ? "text-[color:var(--neon-magenta)] hover:bg-[color:var(--neon-magenta)]/10"
                        : "text-[color:var(--fg)] hover:bg-[color:var(--neon-cyan)]/10 hover:text-[color:var(--neon-cyan)]"
                    }`}
                    role="menuitem"
                  >
                    <span>{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 bg-[color:var(--neon-magenta)] text-black">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ) : (
                <li key={item.label}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      item.onClick?.();
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] transition ${
                      item.tone === "danger"
                        ? "text-[color:var(--neon-magenta)] hover:bg-[color:var(--neon-magenta)]/10"
                        : "text-[color:var(--fg)] hover:bg-[color:var(--neon-cyan)]/10 hover:text-[color:var(--neon-cyan)]"
                    }`}
                    role="menuitem"
                  >
                    <span>{item.label}</span>
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
