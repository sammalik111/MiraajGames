"use client";

// Top-level navigation. Renders three pieces:
//   1. NavRail        — fixed left rail on desktop (md+)
//   2. Mobile top bar — sticky top, hamburger only, hidden on desktop
//   3. MobileNav      — slide-out drawer that the hamburger opens
//
// Pages still import this single component; it handles both viewports.
// Adding a new top-level route means editing NavRail's PRIMARY_NAV and
// MobileNav's PRIMARY arrays — never this file.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import NavRail from "@/components/NavRail";
import MobileNav from "@/components/MobileNav";

export default function Navbar() {
  const { authed } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Unread fetch — used by both the mobile hamburger dot and the drawer.
  useEffect(() => {
    if (!authed) {
      setUnread(0);
      return;
    }
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
      } catch {}
    };
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [authed]);

  return (
    <>
      {/* Desktop rail */}
      <NavRail />

      {/* Mobile top bar */}
      <nav className="md:hidden sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--bg)]/85 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="hud-clip h-8 w-8 bg-[color:var(--neon-cyan)] flex items-center justify-center">
              <span className="font-display font-black text-black text-xs">M</span>
            </div>
            <span className="font-display font-bold text-sm text-[color:var(--fg)]">
              MIRAAJ<span className="text-[color:var(--neon-magenta)]">//</span>GAMES
            </span>
          </Link>

          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="hud-clip relative h-9 w-9 flex items-center justify-center border border-[color:var(--border-strong)] hover:border-[color:var(--neon-cyan)] transition"
          >
            <span className="flex flex-col gap-1.5">
              <span className="block w-4 h-px bg-[color:var(--fg)]" />
              <span className="block w-4 h-px bg-[color:var(--fg)]" />
              <span className="block w-4 h-px bg-[color:var(--fg)]" />
            </span>
            {authed && unread > 0 && (
              <span
                aria-hidden
                className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[color:var(--neon-magenta)] ring-2 ring-[color:var(--bg)]"
              />
            )}
          </button>
        </div>
      </nav>

      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        unread={unread}
      />
    </>
  );
}
