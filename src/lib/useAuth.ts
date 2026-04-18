"use client";

import { signIn, signOut as nextAuthSignOut, useSession } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    session,
    status,
    user: session?.user,
    isAuthenticated: status === "authenticated",
    signIn,
    signOut: nextAuthSignOut,
  };
}
