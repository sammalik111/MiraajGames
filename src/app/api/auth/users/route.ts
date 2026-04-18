import { NextResponse } from "next/server";
import { users } from "@/auth.config";

export async function GET() {
  // Return users without passwords for security
  const safeUsers = users.map(({ password, ...user }) => user);

  return NextResponse.json({
    total: users.length,
    users: safeUsers
  });
}