"use client";

import Navbar from "@/components/navbar";
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

function Avatar({ name, image, size = 48 }: { name: string; image?: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-green-500",
    "bg-rose-500", "bg-amber-500", "bg-teal-500",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold ${color}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
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
      const favorites = await retrieveFavorites();
      setFavoriteIds(favorites);
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
        // silently fail
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
      if (!res.ok) { setPasswordMessage(data.error || "Unable to update password"); return; }
      setPasswordMessage("Password updated successfully.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
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
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-center mb-12 text-black dark:text-white">
          User Profile
        </h1>

        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8">
          {/* User Info */}
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
              U
            </div>
            <div>
              <h2 className="text-3xl font-semibold text-black dark:text-white">
                {session?.user?.name || "Demo User"}
              </h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                {session?.user?.email || "demo@example.com"}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                My Friend ID: {session?.user?.id}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8 py-8 border-t border-b border-zinc-200 dark:border-zinc-800">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{loadingProfile ? "—" : profileStats?.gamesPlayed ?? "—"}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Games Played</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{loadingProfile ? "—" : profileStats?.achievements ?? "—"}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Achievements</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{loadingProfile ? "—" : profileStats?.points ?? "—"}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Points</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
            <div className="rounded-3xl bg-slate-100/80 dark:bg-zinc-800 p-4">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Favorites</p>
              <p className="mt-2 text-2xl font-bold text-violet-600">{loadingProfile ? "—" : profileStats?.favoriteCount ?? "—"}</p>
            </div>
            <div className="rounded-3xl bg-slate-100/80 dark:bg-zinc-800 p-4">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Member Tier</p>
              <p className="mt-2 text-2xl font-bold text-sky-600">{profileStats?.favoriteCount && profileStats.favoriteCount > 3 ? "Pro" : "Starter"}</p>
            </div>
            <div className="rounded-3xl bg-slate-100/80 dark:bg-zinc-800 p-4">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Activity</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{loadingProfile ? "—" : `${profileStats?.favoriteCount ?? 0} favs`}</p>
            </div>
          </div>

          {/* Friends */}
          <div className="mb-10">
            <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
              Friends
              {!loadingFriends && friends.length > 0 && (
                <span className="ml-2 text-sm font-normal text-zinc-400">{friends.length}</span>
              )}
            </h3>
            {loadingFriends ? (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 animate-pulse">
                    <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-zinc-800" />
                    <div className="h-3 w-10 bg-slate-200 dark:bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            ) : friends.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No friends yet.{" "}
                <Link href="/messages" className="text-blue-500 hover:underline">
                  Add some from the Messages page.
                </Link>
              </p>
            ) : (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {friends.map((friend) => (
                  <Link
                    key={friend.id}
                    href={`/messages/${friend.id}`}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
                  >
                    <div className="ring-2 ring-transparent group-hover:ring-blue-500 rounded-full transition-all">
                      <Avatar name={friend.name} image={friend.image} size={56} />
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500 transition-colors max-w-[60px] truncate text-center">
                      {friend.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Account Settings */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-black dark:text-white mb-4">Account Settings</h3>
            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
              Edit Profile
            </button>
            <button
              onClick={() => setShowPasswordForm((v) => !v)}
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-black dark:text-white font-medium rounded-lg transition-colors"
            >
              {showPasswordForm ? "Hide Password Form" : "Change Password"}
            </button>
            {showPasswordForm && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="space-y-4">
                  {[
                    { label: "Current Password", value: currentPassword, set: setCurrentPassword },
                    { label: "New Password", value: newPassword, set: setNewPassword },
                    { label: "Confirm Password", value: confirmPassword, set: setConfirmPassword },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
                      <input
                        type="password"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
                      />
                    </div>
                  ))}
                  <button
                    onClick={handlePasswordChange}
                    className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
                  >
                    Save Password
                  </button>
                  {passwordMessage && <p className="text-sm text-slate-500 dark:text-slate-400">{passwordMessage}</p>}
                </div>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>

          {/* Favorite Games */}
          <div className="mt-12">
            <h3 className="text-xl font-semibold text-black dark:text-white mb-4">Your Favorite Games</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {games.filter((game) => favoriteIds.includes(game.id)).map((game) => (
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
          </div>
        </div>
      </div>
    </div>
  );
}