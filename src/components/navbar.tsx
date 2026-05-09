"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import NavRail from "./navrail";

export default function Navbar() {
  const { authed } = useAuth();
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


        </div>
      </nav>
    </>
  );
}
