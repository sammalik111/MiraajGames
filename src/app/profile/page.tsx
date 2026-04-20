"use client";

import Navbar from "@/components/navbar";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { games } from "@/data/gameData";
import GameCard  from "@/components/gameCard";

interface ProfileStats {
  favoriteCount: number;
  gamesPlayed: number;
  achievements: number;
  points: number;
}

export default function Profile() {
  const router = useRouter();

  // Get session data and authentication status
  const { data: session, status } = useSession();
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);


  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/"); // Redirect to home if not authenticated
    }
  }, // Only run this effect when authentication status changes 
  [status, router]);

  useEffect(() => {
    const loadProfileStats = async () => {
      if (status !== "authenticated") {
        return;
      }

      setLoadingProfile(true);
      const favorites = await retrieveFavorites();
      setFavoriteIds(favorites);

      try {
        const response = await fetch("/api/auth/profile");
        if (!response.ok) {
          throw new Error("Could not load profile stats");
        }
        const data = await response.json();
        setProfileStats(data.stats);
      } catch (error) {
        console.error("Profile load error:", error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfileStats();
  }, [status]);

  const handlePasswordChange = async () => {
    setPasswordMessage(null);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setPasswordMessage(data.error || "Unable to update password");
        return;
      }

      setPasswordMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Password update error:", error);
      setPasswordMessage("Unable to update password");
    }
  };


  const retrieveFavorites = async () => {
    try {
      const response = await fetch("/api/auth/favorites");
      if (!response.ok) {
        throw new Error("Could not retrieve favorites");
      }
      const data = await response.json();
      console.log("User favorites:", data);

      if (!session || !session.user) {
        console.log("No user session found.");
        return [];
      }

      const userId = session.user.id as string;
      console.log("User ID from session:", userId);
      let favoriteIds = [];
      for (const userFav of data.favorites) {
        if (userFav.userId === userId) {
          console.log("Match found for user ID:", userFav.userId);  
          favoriteIds = userFav.favorites;
        }
      }
      console.log("Favorite IDs for current user:", favoriteIds);
      return favoriteIds;
    }
    catch (error) {
      console.error("Error retrieving favorites:", error);
      return [];
    }
  }


  // If the session is still loading, you can show a loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }
  
  // If the user is authenticated, show the profile page for this specific user session
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

          {/* Account Settings */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
              Account Settings
            </h3>
            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
              Edit Profile
            </button>
            <button
              onClick={() => setShowPasswordForm((value) => !value)}
              className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-black dark:text-white font-medium rounded-lg transition-colors"
            >
              {showPasswordForm ? "Hide Password Form" : "Change Password"}
            </button>
            {showPasswordForm ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
                    />
                  </div>
                  <button
                    onClick={handlePasswordChange}
                    className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
                  >
                    Save Password
                  </button>
                  {passwordMessage ? <p className="text-sm text-slate-500 dark:text-slate-400">{passwordMessage}</p> : null}
                </div>
              </div>
            ) : null}
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

            
            {/* filter gamecards to only ones that match the favoriteIds */}
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
