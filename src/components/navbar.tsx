"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();

  const handleSignOut = async () => {
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl shadow-xl shadow-slate-950/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-lg shadow-violet-500/20">
            M
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-white">Miraaj Games</p>
            <p className="text-xs text-slate-400">Play. Save. Share.</p>
          </div>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="/" className="text-sm font-medium text-slate-300 transition hover:text-white">
            Home
          </Link>
          <Link href="/#games" className="text-sm font-medium text-slate-300 transition hover:text-white">
            Games
          </Link>
          <Link href="/profile" className="text-sm font-medium text-slate-300 transition hover:text-white">
            Profile
          </Link>
          <Link href="/messages" className="text-sm font-medium text-slate-300 transition hover:text-white">
            Messages
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {session ? (
            <>
              <div className="rounded-full border border-slate-800 bg-slate-900/90 px-4 py-2 text-sm text-slate-200">
                {session.user?.email}
              </div>
              <button
                onClick={handleSignOut}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
