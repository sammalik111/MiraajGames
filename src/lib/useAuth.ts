"use client";

import { signIn, signOut as nextAuthSignOut, useSession } from "next-auth/react";

// Client-side session hook used by every authorized component. the client can't have the 
// NEXT_AUTH_SECRET JWT, so we can't verify the session on the client. Instead, use useSession()
// which call "fetch /api/auth/session" to get the session data, which is verified server-side without 
// exposing the secret. This function wraps useSession with a simpler interface and makes sure hydration occured before returning a user ID
//
// Usage:
//   const { userId, loading } = useAuth();
//   if (loading || !userId) return null;
//   // ... userId is guaranteed
export function useAuth() {
  const { data: session, status } = useSession();
  const authed = status === "authenticated";

  return {
    session,
    status,
    user: session?.user,
    userId: authed ? ((session!.user!.id as string) ?? null) : null,
    loading: status === "loading",
    authed,
    isAuthenticated: authed,
    signIn,
    signOut: nextAuthSignOut,
  };
}
