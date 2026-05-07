"use client";

// Top navigation bar.
//
// Three regions, designed to scale without cluttering:
//   1. Brand (left) — logo + tagline. Static, doesn't grow.
//   2. Primary nav (center on desktop) — public-facing app surface
//      (Home / Games / Contact). Should grow slowly.
//   3. User cluster (right) — theme toggle + UserMenu. The UserMenu
//      dropdown is where ALL user-scoped features live (profile, inbox,
//      future settings/friends/achievements). Adding a new user feature
//      means adding one row to UserMenu — never another item to this bar.
//
// Below the `md` breakpoint, primary + user collapse behind a hamburger
// that opens MobileNav (a slide-out drawer).

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import UserMenu from "@/components/UserMenu";
import MobileNav from "@/components/MobileNav";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active =
    pathname === href || (href !== "/" && pathname.startsWith(href.split("#")[0]));
  return (
    <Link
      href={href}
      className={`relative font-mono text-xs uppercase tracking-[0.22em] py-1.5 px-2 transition ${
        active
          ? "text-[color:var(--neon-cyan)] dark:glow-cyan"
          : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
      }`}
    >
      {children}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 right-0 -bottom-0.5 h-px bg-[color:var(--neon-cyan)] ring-cyan"
        />
      )}
    </Link>
  );
}

export default function Navbar() {
  const { authed } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Mirror the unread fetch from UserMenu so MobileNav can show the same
  // badge. Could be hoisted into context if a third surface needs it.
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
      <nav className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--bg)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <div className="relative hud-clip h-9 w-9 bg-[color:var(--neon-cyan)] flex items-center justify-center">
              <span className="font-display font-black text-black text-sm">M</span>
            </div>
            <div className="leading-tight hidden sm:block">
              <p className="font-display font-bold text-base text-[color:var(--fg)]">
                MIRAAJ<span className="text-[color:var(--neon-magenta)]">//</span>GAMES
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
                sys.net &gt; online<span className="blink text-[color:var(--neon-cyan)]">_</span>
              </p>
            </div>
          </Link>

          {/* Primary nav (desktop) */}
          <div className="hidden md:flex items-center gap-2 lg:gap-4 ml-4">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/#games">Games</NavLink>
            <NavLink href="/contactUs">Contact</NavLink>
          </div>

          {/* Spacer — pushes user cluster to the right */}
          <div className="flex-1" />

          {/* User cluster (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <UserMenu />
          </div>

          {/* Mobile cluster — hamburger only (theme picker lives in /profile) */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="hud-clip relative h-9 w-9 flex items-center justify-center border border-[color:var(--border-strong)] hover:border-[color:var(--neon-cyan)] transition"
            >
              {/* Hamburger glyph */}
              <span className="flex flex-col gap-1.5">
                <span className="block w-4 h-px bg-[color:var(--fg)]" />
                <span className="block w-4 h-px bg-[color:var(--fg)]" />
                <span className="block w-4 h-px bg-[color:var(--fg)]" />
              </span>
              {/* Unread dot — visible on mobile so users know there's
                  something waiting without opening the drawer */}
              {authed && unread > 0 && (
                <span
                  aria-hidden
                  className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[color:var(--neon-magenta)] ring-2 ring-[color:var(--bg)]"
                />
              )}
            </button>
          </div>
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
