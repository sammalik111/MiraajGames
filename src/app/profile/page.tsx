"use client";

import Navbar from "@/components/navbar";
import HudPanel from "@/components/HudPanel";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { games } from "@/data/gameData";
import GameCard from "@/components/gameCard";
import Link from "next/link";

interface ProfileStats {
  favoriteCount: number;
  gamesPlayed: number;
  achievements: number;
  points: number;
}

interface Friend {
  id: string;
  name: string;
  image?: string;
}

// Neon monogram avatar — picks a deterministic accent from the name.
function Avatar({ name, image, size = 48 }: { name: string; image?: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const accents = ["var(--neon-cyan)", "var(--neon-magenta)", "var(--neon-yellow)", "var(--neon-lime)"];
  const accent = accents[name.charCodeAt(0) % accents.length];

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="object-cover flex-shrink-0 hud-clip"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="hud-clip flex items-center justify-center flex-shrink-0 font-display font-black text-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: accent,
        boxShadow: `0 0 14px -4px ${accent}`,
      }}
    >
      {initials}
    </div>
  );
}

export default function Profile() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const load = async () => {
      setLoadingProfile(true);
      const favs = await retrieveFavorites();
      setFavoriteIds(favs);
      try {
        const res = await fetch("/api/auth/profile");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setProfileStats(data.stats);
      } catch (error) {
        console.error("Profile load error:", error);
      } finally {
        setLoadingProfile(false);
      }
    };

    const loadFriends = async () => {
      setLoadingFriends(true);
      try {
        const res = await fetch("/api/auth/getFriends");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setFriends(data.friends ?? []);
      } catch {
        /* silent */
      } finally {
        setLoadingFriends(false);
      }
    };

    load();
    loadFriends();
  }, [status]);

  const handlePasswordChange = async () => {
    setPasswordMessage(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMessage(data.error || "Unable to update password");
        return;
      }
      setPasswordMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMessage("Unable to update password");
    }
  };

  const retrieveFavorites = async () => {
    try {
      const res = await fetch("/api/auth/favorites");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!session?.user) return [];
      const userId = session.user.id as string;
      for (const userFav of data.favorites) {
        if (userFav.userId === userId) return userFav.favorites;
      }
      return [];
    } catch {
      return [];
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            <span className="blink">●</span> Establishing link...
          </p>
        </div>
      </div>
    );
  }

  const userName = session?.user?.name || "Operator";
  const userEmail = session?.user?.email || "unknown@mesh";
  const userId = session?.user?.id as string | undefined;
  const favCount = profileStats?.favoriteCount ?? 0;
  const tier = favCount > 3 ? "Pro" : "Starter";

  const favoriteGames = games.filter((g) => favoriteIds.includes(g.id));

  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />
      <main className="relative z-10 max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
            ┌─ Section 01 · Operator Profile
          </p>
          <h1 className="font-display font-black text-4xl sm:text-5xl mt-3 tracking-tight text-[color:var(--fg)]">
            <span className="text-[color:var(--neon-magenta)] dark:glow-magenta">//</span>{" "}
            {userName.toUpperCase()}
          </h1>
        </div>

        {/* Identity card */}
        <HudPanel innerClassName="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <Avatar name={userName} size={88} />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                &gt; Handle
              </p>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-[color:var(--fg)] mt-1 truncate">
                {userName}
              </h2>
              <p className="text-sm text-[color:var(--fg-muted)] mt-1 truncate">{userEmail}</p>
              {userId && (
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)] mt-3">
                  id&nbsp;::&nbsp;
                  <span className="text-[color:var(--neon-cyan)] dark:glow-cyan normal-case tracking-normal">
                    {userId}
                  </span>
                </p>
              )}
            </div>
            <div className="hud-chip self-start sm:self-center">
              <span className="text-[color:var(--neon-cyan)]">●</span> Tier · {tier}
            </div>
          </div>

          {/* Stat rail */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[color:var(--border)]">
            {[
              { label: "Games Played", value: profileStats?.gamesPlayed, accent: "cyan" },
              { label: "Achievements", value: profileStats?.achievements, accent: "magenta" },
              { label: "Points", value: profileStats?.points, accent: "yellow" },
              { label: "Favorites", value: profileStats?.favoriteCount, accent: "lime" },
            ].map((stat) => (
              <div key={stat.label} className="border-l-2 border-[color:var(--border-strong)] pl-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                  {stat.label}
                </dt>
                <dd
                  className={`font-display font-bold text-2xl mt-1 text-${stat.accent} dark:glow-${stat.accent}`}
                >
                  {loadingProfile ? "—" : (stat.value ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        </HudPanel>

        {/* Friends */}
        <section className="mt-12">
          <div className="flex items-end justify-between pb-4 border-b border-[color:var(--border)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                ┌─ Network · Allies
              </p>
              <h3 className="font-display font-bold text-2xl mt-2 text-[color:var(--fg)]">
                Friends
              </h3>
            </div>
            {!loadingFriends && friends.length > 0 && (
              <span className="hud-chip">{friends.length} linked</span>
            )}
          </div>

          <div className="mt-6">
            {loadingFriends ? (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0 animate-pulse">
                    <div className="w-14 h-14 hud-clip bg-[color:var(--surface-2)]" />
                    <div className="h-2 w-12 bg-[color:var(--surface-2)]" />
                  </div>
                ))}
              </div>
            ) : friends.length === 0 ? (
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
                &gt; No allies linked.{" "}
                <Link href="/messages" className="text-[color:var(--neon-cyan)] dark:glow-cyan hover:underline">
                  Find some in Messages
                </Link>
              </p>
            ) : (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {friends.map((friend) => (
                  <Link
                    key={friend.id}
                    href={`/messages/${friend.id}`}
                    className="flex flex-col items-center gap-2 flex-shrink-0 group"
                  >
                    <Avatar name={friend.name} image={friend.image} size={60} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--fg-muted)] group-hover:text-[color:var(--neon-cyan)] transition-colors max-w-[72px] truncate text-center">
                      {friend.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Account */}
        <section className="mt-12">
          <div className="flex items-end justify-between pb-4 border-b border-[color:var(--border)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                ┌─ Account · Controls
              </p>
              <h3 className="font-display font-bold text-2xl mt-2 text-[color:var(--fg)]">
                Settings
              </h3>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setShowPasswordForm((v) => !v)}
              className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-3 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:ring-cyan transition"
            >
              {showPasswordForm ? "Close · Password Form" : "Rotate Credentials"}
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-3 border border-[color:var(--neon-magenta)] text-[color:var(--neon-magenta)] hover:ring-magenta transition"
            >
              Disconnect · Sign Out
            </button>
          </div>

          {showPasswordForm && (
            <HudPanel className="mt-6" innerClassName="p-6 space-y-4">
              {[
                { label: "Current Password", value: currentPassword, set: setCurrentPassword },
                { label: "New Password", value: newPassword, set: setNewPassword },
                { label: "Confirm Password", value: confirmPassword, set: setConfirmPassword },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                    {label}
                  </label>
                  <input
                    type="password"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="mt-2 w-full bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] px-4 py-3 text-sm text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition"
                  />
                </div>
              ))}
              <button
                onClick={handlePasswordChange}
                className="w-full font-mono text-xs uppercase tracking-[0.2em] px-4 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
              >
                Commit New Key →
              </button>
              {passwordMessage && (
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
                  &gt; {passwordMessage}
                </p>
              )}
            </HudPanel>
          )}
        </section>

        {/* Favorites */}
        <section className="mt-12">
          <div className="flex items-end justify-between pb-4 border-b border-[color:var(--border)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                ┌─ Cache · Favorites
              </p>
              <h3 className="font-display font-bold text-2xl mt-2 text-[color:var(--fg)]">
                Saved Cabinets
              </h3>
            </div>
            <span className="hud-chip">{favoriteGames.length} saved</span>
          </div>

          {favoriteGames.length === 0 ? (
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
              &gt; Cache empty. Mark cabinets with ☆ from the library.
            </p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {favoriteGames.map((game) => (
                <GameCard
                  key={game.id}
                  id={game.id}
                  title={game.title}
                  description={game.description}
                  creator={game.creator}
                  theme={game.theme}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
