"use client";

// Slide-out mobile navigation. The desktop navbar collapses to a hamburger
// + brand mark below the `md` breakpoint, and tapping the hamburger reveals
// the same primary + user nav items as a vertical drawer.

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

interface NavItem {
  href: string;
  label: string;
  badge?: number | null;
  authedOnly?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  unread: number;
}

const PRIMARY: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/#games", label: "Games" },
  { href: "/contactUs", label: "Contact" },
];

const ACCOUNT: NavItem[] = [
  { href: "/profile", label: "Profile", authedOnly: true },
  { href: "/messages", label: "Messages", authedOnly: true }, // badge wired below
];

export default function MobileNav({ open, onClose, unread }: Props) {
  const pathname = usePathname();
  const { authed } = useAuth();

  // Lock body scroll while the drawer's open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close drawer on route change (Next provides a new pathname).
  useEffect(() => {
    onClose();
    // intentional: only respond to pathname changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={`md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <aside
        className={`md:hidden fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] border-l border-[color:var(--border-strong)] bg-[color:var(--surface-1)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)] bg-[color:var(--surface-2)]">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--neon-cyan)]">
              ▸ Navigation
            </span>
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="font-mono text-[color:var(--fg-muted)] hover:text-[color:var(--neon-magenta)] transition"
            >
              [×]
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            {/* Primary section */}
            <SectionHeader>App</SectionHeader>
            {PRIMARY.map((item) => (
              <DrawerLink
                key={item.href}
                href={item.href}
                active={pathname === item.href}
                onClick={onClose}
              >
                {item.label}
              </DrawerLink>
            ))}

            {/* Account section — only authed users see this */}
            {authed && (
              <>
                <SectionHeader>Account</SectionHeader>
                {ACCOUNT.map((item) => (
                  <DrawerLink
                    key={item.href}
                    href={item.href}
                    active={pathname === item.href}
                    onClick={onClose}
                    badge={
                      item.label === "Messages" && unread > 0 ? unread : null
                    }
                  >
                    {item.label}
                  </DrawerLink>
                ))}
              </>
            )}
          </nav>

          {/* Footer auth buttons */}
          <div className="border-t border-[color:var(--border)] p-4">
            {authed ? (
              <button
                onClick={handleSignOut}
                className="w-full font-mono text-xs uppercase tracking-[0.2em] px-3 py-2.5 border border-[color:var(--neon-magenta)] text-[color:var(--neon-magenta)] hover:bg-[color:var(--neon-magenta)]/10 transition"
              >
                Disconnect
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/auth/signin"
                  onClick={onClose}
                  className="text-center font-mono text-xs uppercase tracking-[0.2em] px-3 py-2.5 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:ring-cyan transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={onClose}
                  className="text-center font-mono text-xs uppercase tracking-[0.2em] px-3 py-2.5 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
                >
                  Jack In
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 pt-4 pb-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[color:var(--fg-muted)]">
      ── {children} ──
    </p>
  );
}

function DrawerLink({
  href,
  active,
  onClick,
  badge,
  children,
}: {
  href: string;
  active: boolean;
  onClick: () => void;
  badge?: number | null;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between px-5 py-3 font-mono text-xs uppercase tracking-[0.22em] transition ${
        active
          ? "text-[color:var(--neon-cyan)] bg-[color:var(--neon-cyan)]/5 border-l-2 border-[color:var(--neon-cyan)]"
          : "text-[color:var(--fg)] hover:bg-[color:var(--neon-cyan)]/10 hover:text-[color:var(--neon-cyan)] border-l-2 border-transparent"
      }`}
    >
      <span>{children}</span>
      {badge != null && badge > 0 && (
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 bg-[color:var(--neon-magenta)] text-black">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
