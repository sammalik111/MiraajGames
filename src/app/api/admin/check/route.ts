// GET /api/admin/check
// Lightweight check the navrail uses to decide whether to render the
// "Dashboards" link. Returns { isAdmin: boolean } without leaking the
// admin id list itself.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { isAdmin } from "@/lib/requireAdmin";

export async function GET() {
  const userId = await requireUser();
  if (typeof userId !== "string") {
    // Not authed — also not admin. Return false rather than 401 so the
    // navrail can quietly skip rendering the icon.
    return NextResponse.json({ isAdmin: false });
  }
  return NextResponse.json({ isAdmin: isAdmin(userId) });
}
