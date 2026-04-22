"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";

// Cyberpunk nav link. Underline glints cyan when active.
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
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
  const { data: session } = useSession();

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
    <nav className="sticky top-0 z-50 border-b border-[color:var(--border)] bg-[color:var(--bg)]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative hud-clip h-10 w-10 bg-[color:var(--neon-cyan)] flex items-center justify-center">
            <span className="font-display font-black text-black text-sm">M</span>
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-base text-[color:var(--fg)]">
              MIRAAJ<span className="text-[color:var(--neon-magenta)]">//</span>GAMES
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
              sys.net &gt; online<span className="blink text-[color:var(--neon-cyan)]">_</span>
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/#games">Games</NavLink>
          <NavLink href="/profile">Profile</NavLink>
          <NavLink href="/messages">Messages</NavLink>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {session ? (
            <>
              <div className="hud-chip">
                <span className="text-[color:var(--neon-cyan)]">●</span>
                <span className="normal-case tracking-normal text-xs">
                  {session.user?.email?.split("@")[0] ?? "player"}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="font-mono text-xs uppercase tracking-[0.2em] px-3 py-1.5 border border-[color:var(--neon-magenta)] text-[color:var(--neon-magenta)] hover:ring-magenta transition"
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
