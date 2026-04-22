import { NextResponse } from "next/server";
import { users } from "@/auth.config";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = users.find((u) => u.id === id);
  if (!user) return NextResponse.json({ user: null }, { status: 404 });
  const { password: _pw, ...safe } = user;
  return NextResponse.json({ user: safe });
}
