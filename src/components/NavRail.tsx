"use client";

// Vertical desktop navigation rail.
//
// Sits fixed on the left edge at 56px wide, never scrolls with content.
// Top → bottom:
//   - Brand mark
//   - Primary nav (Home, Library)
//   - Account nav (Profile, Messages) — authed-only, with unread badge
//   - User menu (sign out, settings, etc.)
//
// Adding a new top-level route is one entry in PRIMARY_NAV; adding a new
// account-scoped quick-access route is one entry in ACCOUNT_NAV.
//
// Mobile gets the existing top-bar Navbar + MobileNav drawer instead;
// the rail is `hidden` below the md breakpoint.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import UserMenu from "@/components/UserMenu";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const ICON = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  games: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" />
      <path d="M6 12h3M7.5 10.5v3" />
      <circle cx="15.5" cy="11" r="0.8" fill="currentColor" />
      <circle cx="17.5" cy="13" r="0.8" fill="currentColor" />
    </svg>
  ),
  profile: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  ),
  messages: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h16v11H8l-4 4z" />
    </svg>
  ),
  signIn: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </svg>
  ),
};

const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: ICON.home },
  { href: "/#library", label: "Library", icon: ICON.games },
];

const ACCOUNT_NAV: NavItem[] = [
  { href: "/profile", label: "Profile", icon: ICON.profile },
  { href: "/messages", label: "Messages", icon: ICON.messages },
];

function RailLink({
  href,
  label,
  icon,
  badge,
}: NavItem & { badge?: number }) {
  const pathname = usePathname();
  const target = href.split("#")[0];
  const active =
    pathname === href || (target !== "/" && pathname.startsWith(target));
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`group relative flex h-12 w-12 items-center justify-center transition ${
        active
          ? "text-[color:var(--neon-cyan)]"
          : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[color:var(--neon-cyan)] ring-cyan"
        />
      )}
      {icon}
      {/* Badge for unread / counts */}
      {badge != null && badge > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[8px] font-mono font-bold bg-[color:var(--neon-magenta)] text-black ring-2 ring-[color:var(--surface)]"
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      {/* Tooltip on hover */}
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.22em] px-2 py-1 bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] text-[color:var(--fg)] opacity-0 group-hover:opacity-100 transition z-50">
        {label}
      </span>
    </Link>
  );
}

export default function NavRail() {
  const { authed } = useAuth();
  const [unread, setUnread] = useState(0);

  // Pull unread count for the Messages badge.
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
    <aside
      className="hidden md:flex fixed left-0 top-0 z-40 h-screen w-14 flex-col items-center justify-between border-r border-[color:var(--border)] bg-[color:var(--surface)]/90 backdrop-blur-xl py-3"
      aria-label="Primary navigation"
    >
      {/* Top: brand + nav stacks */}
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/"
          className="hud-clip h-9 w-9 bg-[color:var(--neon-cyan)] flex items-center justify-center transition hover:brightness-110"
          title="Miraaj Games — Home"
        >
          <span className="font-display font-black text-black text-sm">M</span>
        </Link>

        {/* Primary nav (always visible) */}
        <nav className="flex flex-col items-center gap-1">
          {PRIMARY_NAV.map((item) => (
            <RailLink key={item.href} {...item} />
          ))}
        </nav>

        {/* Account nav (authed only) */}
        {authed && (
          <>
            <span
              aria-hidden
              className="block w-6 h-px bg-[color:var(--border)] my-1"
            />
            <nav className="flex flex-col items-center gap-1">
              <RailLink {...ACCOUNT_NAV[0]} />
              <RailLink {...ACCOUNT_NAV[1]} badge={unread} />
            </nav>
          </>
        )}
      </div>

      {/* Bottom: user menu (or sign-in shortcut for guests) */}
      <div className="flex flex-col items-center gap-2">
        {authed ? (
          <UserMenu placement="rail" />
        ) : (
          <Link
            href="/auth/signin"
            title="Sign in"
            aria-label="Sign in"
            className="group relative flex h-10 w-10 items-center justify-center border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:border-[color:var(--neon-cyan)] hover:text-[color:var(--neon-cyan)] transition"
          >
            {ICON.signIn}
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.22em] px-2 py-1 bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] text-[color:var(--fg)] opacity-0 group-hover:opacity-100 transition z-50">
              Sign In
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}
