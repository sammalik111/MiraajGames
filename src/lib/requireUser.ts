import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Server-side session check used by every authed API route.
// Returns the user id on success, or a 401 NextResponse on failure.
//
// Usage:
//   const userId = await requireUser();
//   if (typeof userId !== "string") return userId;
//   // ... userId is guaranteed
export async function requireUser(): Promise<string | NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return userId;
}
