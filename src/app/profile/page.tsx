"use client";

import Navbar from "@/components/navbar";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

export default function Profile() {
  const router = useRouter();

  // Get session data and authentication status
  const { data: session, status } = useSession();
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/"); // Redirect to home if not authenticated
    }
  }, // Only run this effect when authentication status changes 
  [status, router]);

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
              <p className="text-2xl font-bold text-blue-600">12</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Games Played</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">8</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Achievements</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">1,250</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Points</p>
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
            <button className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-black dark:text-white font-medium rounded-lg transition-colors">
              Change Password
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
