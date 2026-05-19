import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { getTodaysWordleWord } from "@/lib/dailyWordle";

// GET /api/games/19/dailyWord
// Returns today's Wordle answer. Same word for all users on this UTC day.
// Authed-only so the corpus fetch isn't free firepower for scrapers.
export async function GET() {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;
  const word = await getTodaysWordleWord();
  return NextResponse.json({ word });
}
