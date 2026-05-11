// GET  /api/auth/theme — returns { theme, mode } for the current user
// PUT  /api/auth/theme — body { theme?, mode? } updates the prefs
//
// Theme name is server-validated against the allow-list so a malicious
// client can't store arbitrary garbage in the column.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/requireUser";
import { db, users } from "@/db";

const THEMES = new Set([
  "cyberpunk",
  "solarpunk",
  "minimal",
  "city",
  "vaporwave",
  "terminal",
  "pastel",
]);
const MODES = new Set(["light", "dark"]);

export async function GET() {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const [row] = await db
    .select({
      theme: users.preferredTheme,
      mode: users.preferredMode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return NextResponse.json({
    theme: row?.theme ?? null,
    mode: row?.mode ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const { theme, mode } = await req.json().catch(() => ({}));
  const update: { preferredTheme?: string; preferredMode?: string } = {};

  if (theme !== undefined) {
    if (theme !== null && !THEMES.has(theme)) {
      return NextResponse.json(
        { error: "invalid theme" },
        { status: 400 },
      );
    }
    update.preferredTheme = theme;
  }
  if (mode !== undefined) {
    if (mode !== null && !MODES.has(mode)) {
      return NextResponse.json(
        { error: "invalid mode" },
        { status: 400 },
      );
    }
    update.preferredMode = mode;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "nothing to update" },
      { status: 400 },
    );
  }

  await db.update(users).set(update).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
