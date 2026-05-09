import { NextResponse } from "next/server";
import { requireUser } from "./requireUser";

// Comma-separated list of user ids in process.env.ADMIN_IDS, parsed once
// per call. Cheap enough — splits a small string. The set lookup is O(1).
function getAdminIds(): Set<string> {
  const raw = process.env.ADMIN_IDS ?? "";
  console.log(raw);
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isAdmin(userId: string): boolean {
  return getAdminIds().has(userId);
}

// Server-side guard for admin-only routes. Layer over requireUser:
//   const adminId = await requireAdmin();
//   if (typeof adminId !== "string") return adminId;
//   // ... adminId is guaranteed
export async function requireAdmin(): Promise<string | NextResponse> {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return userId;
}
